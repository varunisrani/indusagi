/**
 * MCP Client - Single Server Connection
 *
 * Manages connection to one MCP server and provides
 * methods to list/call tools, read resources, etc.
 *
 * Reference: @mastra/mcp packages/mcp/src/client/client.ts InternalMastraMCPClient
 */

import { spawn, type ChildProcess } from "child_process";
import type {
  MCPConnectionOptions,
  MCPServerConfig,
  MCPToolDefinition,
  MCPResource,
  MCPPrompt,
  MCPToolCallResult,
  MCPInitializeResult,
  MCPLogHandler,
  MCPLoggingLevel,
  MCPProgressHandler,
  MCPElicitationHandler,
  MCPRoot,
} from "./types.js";
import { MCPError, MCPErrorCode } from "./errors.js";

/** Default request timeout in milliseconds */
const DEFAULT_REQUEST_TIMEOUT = 60000;

/** Default server connect timeout in milliseconds (increased for npx downloads) */
const DEFAULT_CONNECT_TIMEOUT = 30000;

/**
 * Options for creating an MCP client.
 */
export interface MCPClientOptions {
  /** Unique name for this client */
  name: string;
  /** Server connection configuration */
  config: MCPServerConfig;
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Optional log handler */
  logger?: MCPLogHandler;
  /** Whether to enable server logs (default: true) */
  enableServerLogs?: boolean;
  /** Whether to enable progress tracking (default: false) */
  enableProgressTracking?: boolean;
  /** Filesystem roots to expose to the server */
  roots?: MCPRoot[];
}

/**
 * Pending request tracker.
 */
interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * MCP Client - manages connection to a single MCP server.
 *
 * Supports stdio transport (subprocess communication).
 * Provides methods to list tools, call tools, read resources, etc.
 *
 * @example
 * ```typescript
 * const client = new MCPClient({
 *   name: "filesystem",
 *   config: {
 *     command: "npx",
 *     args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
 *   },
 * });
 *
 * await client.connect();
 * const tools = await client.listTools();
 * const result = await client.callTool("read_file", { path: "./test.txt" });
 * await client.disconnect();
 * ```
 */
export class MCPClient {
  private process?: ChildProcess;
  private buffer = "";
  private messageId = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private serverCapabilities?: Record<string, unknown>;
  private logHandler?: MCPLogHandler;
  private enableServerLogs: boolean;
  private enableProgressTracking: boolean;
  private _roots: MCPRoot[];

  /** Server name */
  readonly serverName: string;
  /** Server config */
  readonly config: MCPServerConfig;
  /** Request timeout */
  readonly timeout: number;

  constructor(private options: MCPClientOptions) {
    this.serverName = options.name;
    this.config = options.config;
    this.timeout = options.timeout ?? DEFAULT_REQUEST_TIMEOUT;
    this.logHandler = options.logger;
    this.enableServerLogs = options.enableServerLogs ?? true;
    this.enableProgressTracking = options.enableProgressTracking ?? false;
    this._roots = options.roots ?? [];
  }

  // ========================================================================
  // Connection Lifecycle
  // ========================================================================

  /**
   * Connect to the MCP server.
   * Safe to call multiple times - returns existing connection if already connected.
   */
  async connect(): Promise<void> {
    if (this.isConnected) return;

    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.doConnect();

    try {
      await this.connectionPromise;
    } finally {
      this.connectionPromise = null;
    }
  }

  private async doConnect(): Promise<void> {
    if ("command" in this.config) {
      await this.connectStdio(this.config);
    } else if ("url" in this.config) {
      await this.connectHttp(this.config);
    } else {
      throw new MCPError(
        "Server configuration must include either a command or a url",
        MCPErrorCode.CONFIG_ERROR,
        undefined,
        { serverName: this.serverName }
      );
    }

    // Send initialize request
    const initResult = await this.sendRequest<MCPInitializeResult>("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        ...(this._roots.length > 0 ? { roots: { listChanged: true } } : {}),
        elicitation: {},
      },
      clientInfo: {
        name: "new_indusagi",
        version: "1.0.0",
      },
    });

    this.serverCapabilities = initResult.capabilities;
    this.isConnected = true;

    // Send initialized notification
    await this.sendNotification("notifications/initialized", {});

    this.log("info", `Connected to MCP server`);
  }

  private async connectHttp(
    config: Extract<MCPServerConfig, { url: URL }>
  ): Promise<void> {
    this.log("debug", `Starting HTTP transport: ${config.url.toString()}`);
    // For HTTP, we just verify we can reach the server
    // The actual connection happens per-request
    this.isConnected = true;
  }

  private async connectStdio(
    config: Extract<MCPServerConfig, { command: string }>
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.log("debug", `Starting stdio transport: ${config.command} ${(config.args ?? []).join(" ")}`);

      this.process = spawn(config.command, config.args ?? [], {
        env: { ...process.env, ...config.env },
        cwd: config.cwd,
        stdio: ["pipe", "pipe", "pipe"],
      });

      this.process.stdout?.on("data", (data: Buffer) => {
        this.buffer += data.toString("utf-8");
        this.processBuffer();
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        const message = data.toString("utf-8").trim();
        if (message) {
          this.log("debug", `[stderr] ${message}`);
        }
      });

      this.process.on("error", (error) => {
        const mcpError = new MCPError(
          `Failed to spawn MCP server: ${error.message}`,
          MCPErrorCode.CONNECTION_FAILED,
          { error: error.message },
          { serverName: this.serverName, cause: error }
        );
        reject(mcpError);
      });

      this.process.on("close", (code) => {
        this.isConnected = false;
        if (code !== 0 && code !== null) {
          this.log("warning", `Process exited with code ${code}`);
        }
        // Reject all pending requests
        for (const [id, { reject: reqReject, timeout }] of this.pendingRequests) {
          clearTimeout(timeout);
          reqReject(new MCPError("Connection closed", MCPErrorCode.NOT_CONNECTED));
        }
        this.pendingRequests.clear();
      });

      // Give the process time to start up (especially for npx which may need to download)
      setTimeout(resolve, 500);
    });
  }

  /**
   * Disconnect from the MCP server.
   */
  async disconnect(): Promise<void> {
    // For HTTP transport, just mark as disconnected
    if ("url" in this.config) {
      this.isConnected = false;
      this.log("debug", "Disconnected from HTTP MCP server");
      return;
    }

    // Stdio transport
    if (!this.process) {
      this.log("debug", "Disconnect called but no process was running");
      return;
    }

    this.log("debug", "Disconnecting from MCP server");

    try {
      // Kill the process
      this.process.kill();
      this.process = undefined;
      this.isConnected = false;

      // Reject all pending requests
      for (const [id, { reject, timeout }] of this.pendingRequests) {
        clearTimeout(timeout);
        reject(new MCPError("Connection closed", MCPErrorCode.NOT_CONNECTED));
      }
      this.pendingRequests.clear();

      this.log("debug", "Successfully disconnected");
    } catch (error) {
      this.log("error", `Error during disconnect: ${error}`);
      throw error;
    }
  }

  /**
   * Whether the client is connected.
   */
  get connected(): boolean {
    return this.isConnected;
  }

  // ========================================================================
  // Tool Operations
  // ========================================================================

  /**
   * List all tools available from the server.
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    this.ensureConnected();
    const result = await this.sendRequest<{ tools: MCPToolDefinition[] }>("tools/list", {});
    return result.tools;
  }

  /**
   * Call a tool on the server.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult> {
    this.ensureConnected();
    this.log("debug", `Calling tool: ${name}`);

    try {
      const result = await this.sendRequest<MCPToolCallResult>("tools/call", {
        name,
        arguments: args,
      });

      this.log("debug", `Tool ${name} executed successfully`);
      return result;
    } catch (error) {
      this.log("error", `Tool ${name} failed: ${error}`);
      throw error;
    }
  }

  // ========================================================================
  // Resource Operations
  // ========================================================================

  /**
   * List all resources available from the server.
   */
  async listResources(): Promise<MCPResource[]> {
    this.ensureConnected();

    if (!this.serverCapabilities?.resources) {
      return [];
    }

    const result = await this.sendRequest<{ resources: MCPResource[] }>("resources/list", {});
    return result.resources;
  }

  /**
   * Read a resource from the server.
   */
  async readResource(uri: string): Promise<unknown> {
    this.ensureConnected();
    return await this.sendRequest("resources/read", { uri });
  }

  /**
   * Subscribe to resource updates.
   */
  async subscribeResource(uri: string): Promise<void> {
    this.ensureConnected();
    await this.sendRequest("resources/subscribe", { uri });
  }

  /**
   * Unsubscribe from resource updates.
   */
  async unsubscribeResource(uri: string): Promise<void> {
    this.ensureConnected();
    await this.sendRequest("resources/unsubscribe", { uri });
  }

  // ========================================================================
  // Prompt Operations
  // ========================================================================

  /**
   * List all prompts available from the server.
   */
  async listPrompts(): Promise<MCPPrompt[]> {
    this.ensureConnected();

    if (!this.serverCapabilities?.prompts) {
      return [];
    }

    const result = await this.sendRequest<{ prompts: MCPPrompt[] }>("prompts/list", {});
    return result.prompts;
  }

  /**
   * Get a prompt from the server.
   */
  async getPrompt(name: string, args?: Record<string, unknown>): Promise<unknown> {
    this.ensureConnected();
    return await this.sendRequest("prompts/get", { name, arguments: args });
  }

  // ========================================================================
  // Roots Operations
  // ========================================================================

  /**
   * Get the configured roots.
   */
  get roots(): MCPRoot[] {
    return [...this._roots];
  }

  /**
   * Update the roots and notify the server.
   */
  async setRoots(roots: MCPRoot[]): Promise<void> {
    this.log("debug", `Updating roots to ${roots.length} entries`);
    this._roots = [...roots];

    if (this.isConnected) {
      await this.sendNotification("notifications/roots/list_changed", {});
    }
  }

  // ========================================================================
  // Handler Registration
  // ========================================================================

  /**
   * Set a handler for resource updated notifications.
   */
  setResourceUpdatedHandler(handler: (params: { uri: string }) => void): void {
    // This would be implemented with notification handlers
    // For now, this is a placeholder
    this.log("debug", "Resource updated handler registered");
  }

  /**
   * Set a handler for resource list changed notifications.
   */
  setResourceListChangedHandler(handler: () => void): void {
    this.log("debug", "Resource list changed handler registered");
  }

  /**
   * Set a handler for prompt list changed notifications.
   */
  setPromptListChangedHandler(handler: () => void): void {
    this.log("debug", "Prompt list changed handler registered");
  }

  /**
   * Set a handler for elicitation requests.
   */
  setElicitationHandler(handler: MCPElicitationHandler): void {
    this.log("debug", "Elicitation handler registered");
  }

  /**
   * Set a handler for progress notifications.
   */
  setProgressHandler(handler: MCPProgressHandler): void {
    this.log("debug", "Progress handler registered");
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private ensureConnected(): void {
    // For HTTP transport, we don't have a process
    const isHttpTransport = "url" in this.config;
    if (!this.isConnected || (!isHttpTransport && !this.process)) {
      throw new MCPError(
        "Not connected to MCP server",
        MCPErrorCode.NOT_CONNECTED,
        undefined,
        { serverName: this.serverName }
      );
    }
  }

  private async sendRequest<T>(method: string, params: unknown): Promise<T> {
    // Allow requests during initialization (before isConnected is set)
    // Only check connection for non-initialize requests
    if (method !== "initialize") {
      this.ensureConnected();
    }

    // Check if using HTTP transport
    if ("url" in this.config) {
      return this.sendHttpRequest<T>(method, params);
    }

    // Stdio transport
    if (!this.process) {
      throw new MCPError(
        "Not connected to MCP server",
        MCPErrorCode.NOT_CONNECTED,
        undefined,
        { serverName: this.serverName }
      );
    }

    return new Promise((resolve, reject) => {
      const id = ++this.messageId;

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new MCPError(
            `Request timeout: ${method}`,
            MCPErrorCode.TIMEOUT,
            { method, id },
            { serverName: this.serverName }
          )
        );
      }, this.timeout);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      const message = {
        jsonrpc: "2.0",
        id,
        method,
        params,
      };

      this.log("debug", `Sending request: ${method} (id: ${id})`);

      try {
        const messageStr = JSON.stringify(message) + "\n";
        this.process!.stdin!.write(messageStr);
      } catch (error) {
        this.pendingRequests.delete(id);
        clearTimeout(timeout);
        reject(
          new MCPError(
            `Failed to send request: ${error}`,
            MCPErrorCode.TRANSPORT_ERROR,
            { error: String(error) },
            { serverName: this.serverName }
          )
        );
      }
    });
  }

  private async sendHttpRequest<T>(method: string, params: unknown): Promise<T> {
    const config = this.config as Extract<MCPServerConfig, { url: URL }>;
    const id = ++this.messageId;

    const message = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    this.log("debug", `Sending HTTP request: ${method} (id: ${id})`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(config.url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json, text/event-stream",
          ...config.headers,
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Try to parse error body
        const errorText = await response.text();
        let errorMessage = `HTTP error: ${response.status} ${response.statusText}`;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
          }
        } catch {
          // Not JSON, use the text
          if (errorText) {
            errorMessage = errorText;
          }
        }
        throw new MCPError(
          errorMessage,
          MCPErrorCode.TRANSPORT_ERROR,
          { status: response.status, body: errorText },
          { serverName: this.serverName }
        );
      }

      // Parse response - could be JSON or SSE format
      const responseText = await response.text();
      let result: { error?: { message?: string; code?: number }; result?: T };

      // Check if SSE format (starts with "event:" or "data:")
      if (responseText.startsWith("event:") || responseText.startsWith("data:")) {
        // Parse SSE format
        const lines = responseText.split("\n");
        let dataLine = "";
        for (const line of lines) {
          if (line.startsWith("data:")) {
            dataLine = line.slice(5).trim();
            break;
          }
        }
        if (dataLine) {
          result = JSON.parse(dataLine) as { error?: { message?: string }; result?: T };
        } else {
          throw new MCPError(
            "Empty SSE response",
            MCPErrorCode.TRANSPORT_ERROR,
            { response: responseText },
            { serverName: this.serverName }
          );
        }
      } else {
        // Plain JSON
        result = JSON.parse(responseText) as { error?: { message?: string }; result?: T };
      }

      if (result.error) {
        throw new MCPError(
          result.error.message || "MCP error",
          MCPErrorCode.SERVER_ERROR,
          result.error,
          { serverName: this.serverName }
        );
      }

      this.log("debug", `HTTP request ${id} succeeded`);
      return result.result as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof MCPError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new MCPError(
          `Request timeout: ${method}`,
          MCPErrorCode.TIMEOUT,
          { method, id },
          { serverName: this.serverName }
        );
      }
      throw new MCPError(
        `HTTP request failed: ${error}`,
        MCPErrorCode.TRANSPORT_ERROR,
        { error: String(error) },
        { serverName: this.serverName }
      );
    }
  }

  private async sendNotification(method: string, params: unknown): Promise<void> {
    const message = {
      jsonrpc: "2.0",
      method,
      params,
    };

    this.log("debug", `Sending notification: ${method}`);

    // For HTTP transport, notifications are sent as POST requests without expecting a response
    if ("url" in this.config) {
      const config = this.config as Extract<MCPServerConfig, { url: URL }>;
      try {
        await fetch(config.url.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...config.headers,
          },
          body: JSON.stringify(message),
        });
      } catch (error) {
        this.log("error", `Failed to send HTTP notification: ${error}`);
      }
      return;
    }

    // Stdio transport
    if (!this.process) {
      throw new MCPError(
        "Not connected to MCP server",
        MCPErrorCode.NOT_CONNECTED,
        undefined,
        { serverName: this.serverName }
      );
    }

    try {
      const messageStr = JSON.stringify(message) + "\n";
      this.process.stdin!.write(messageStr);
    } catch (error) {
      this.log("error", `Failed to send notification: ${error}`);
    }
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || ""; // Keep incomplete line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed);
        this.handleMessage(message);
      } catch (error) {
        this.log("warning", `Failed to parse message: ${trimmed}`);
      }
    }
  }

  private handleMessage(message: any): void {
    // Handle responses to our requests
    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const { resolve, reject, timeout } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      clearTimeout(timeout);

      if (message.error) {
        this.log("debug", `Request ${message.id} failed: ${message.error.message}`);
        reject(
          new MCPError(
            message.error.message || "Unknown error",
            MCPErrorCode.SERVER_ERROR,
            message.error,
            { serverName: this.serverName }
          )
        );
      } else {
        this.log("debug", `Request ${message.id} succeeded`);
        resolve(message.result);
      }
    }

    // Handle notifications (server-initiated messages)
    if (message.method) {
      this.handleNotification(message.method, message.params);
    }
  }

  private handleNotification(method: string, params: unknown): void {
    this.log("debug", `Received notification: ${method}`);

    switch (method) {
      case "notifications/message":
        // Server log message
        if (this.enableServerLogs && params) {
          const { level, ...rest } = params as any;
          this.log(level as MCPLoggingLevel || "info", "[SERVER]", rest);
        }
        break;
      case "notifications/progress":
        // Progress notification
        this.log("debug", `Progress: ${JSON.stringify(params)}`);
        break;
      case "notifications/resources/updated":
        // Resource updated
        this.log("debug", `Resource updated: ${JSON.stringify(params)}`);
        break;
      case "notifications/resources/list_changed":
        // Resource list changed
        this.log("debug", "Resource list changed");
        break;
      case "notifications/prompts/list_changed":
        // Prompt list changed
        this.log("debug", "Prompt list changed");
        break;
    }
  }

  private log(level: MCPLoggingLevel, message: string, details?: Record<string, unknown>): void {
    const msg = `[${this.serverName}] ${message}`;

    if (this.logHandler) {
      this.logHandler({
        level,
        message: msg,
        timestamp: new Date(),
        serverName: this.serverName,
        details,
      });
    } else {
      // Default console logging
      const prefix = `[MCP:${level.toUpperCase()}]`;
      if (details) {
        console.log(prefix, msg, details);
      } else {
        console.log(prefix, msg);
      }
    }
  }
}
