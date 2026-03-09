/**
 * MCP Server
 *
 * Exposes new_indusagi tools as an MCP server.
 * Compatible with Claude Desktop, Cursor, etc.
 *
 * Reference: @mastra/mcp packages/mcp/src/server/server.ts MCPServer
 */

import type * as http from "node:http";
import type { AgentTool } from "../agent/types.js";
import { MCPError, MCPErrorCode } from "./errors.js";

/**
 * Options for creating an MCP server.
 */
export interface MCPServerOptions {
  /** Server name */
  name: string;
  /** Server version */
  version?: string;
  /** Tools to expose */
  tools: AgentTool<any>[];
  /** Optional description */
  description?: string;
}

/**
 * Tool converted for MCP protocol.
 */
interface MCPConvertedTool {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * MCP tool call result.
 */
interface MCPToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

/**
 * MCP Server - exposes new_indusagi tools via the Model Context Protocol.
 *
 * Supports stdio transport for subprocess communication.
 *
 * @example
 * ```typescript
 * import { MCPServer } from "new_indusagi/mcp";
 * import { createBashTool } from "new_indusagi/agent/tools";
 *
 * const server = new MCPServer({
 *   name: "My Tools Server",
 *   version: "1.0.0",
 *   tools: [createBashTool()],
 * });
 *
 * await server.startStdio();
 * ```
 */
export class MCPServer {
  private tools = new Map<string, MCPConvertedTool>();
  private buffer = "";
  private isConnected = false;

  /** Server name */
  readonly name: string;
  /** Server version */
  readonly version: string;

  constructor(private options: MCPServerOptions) {
    this.name = options.name;
    this.version = options.version || "1.0.0";

    // Convert and index tools
    for (const tool of options.tools) {
      const converted = this.convertTool(tool);
      this.tools.set(converted.name, converted);
    }

    console.error(`[MCP Server] Initialized "${this.name}" v${this.version} with ${this.tools.size} tools`);
  }

  // ========================================================================
  // Lifecycle
  // ========================================================================

  /**
   * Start the server using stdio transport.
   *
   * This is typically used when running the server as a subprocess
   * that MCP clients (like Claude Desktop) spawn.
   */
  async startStdio(): Promise<void> {
    this.isConnected = true;

    // Log to stderr so it doesn't interfere with MCP protocol on stdout
    console.error(`[MCP Server] Starting stdio transport`);

    // Set up stdin for reading
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      this.buffer += chunk;
      this.processBuffer();
    });

    process.stdin.on("end", () => {
      console.error(`[MCP Server] Stdin closed, shutting down`);
      this.isConnected = false;
      process.exit(0);
    });

    // Keep the process alive
    return new Promise(() => {});
  }

  /**
   * Stop the server.
   */
  async stop(): Promise<void> {
    this.isConnected = false;
    console.error(`[MCP Server] Stopped`);
  }

  // ========================================================================
  // Tool Management
  // ========================================================================

  /**
   * Add a tool to the server.
   */
  addTool(tool: AgentTool<any>): void {
    const converted = this.convertTool(tool);
    this.tools.set(converted.name, converted);
    console.error(`[MCP Server] Added tool: ${converted.name}`);
  }

  /**
   * Remove a tool from the server.
   */
  removeTool(name: string): boolean {
    const result = this.tools.delete(name);
    if (result) {
      console.error(`[MCP Server] Removed tool: ${name}`);
    }
    return result;
  }

  /**
   * List all available tools.
   */
  listTools(): MCPConvertedTool[] {
    return Array.from(this.tools.values());
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private convertTool(tool: AgentTool<any>): MCPConvertedTool {
    // Convert TypeBox schema to JSON Schema
    const inputSchema = this.typeBoxToJsonSchema(tool.parameters);

    return {
      name: tool.name,
      description: tool.description || tool.label,
      inputSchema,
      execute: async (args: Record<string, unknown>) => {
        const result = await tool.execute(
          `mcp_${Date.now()}`,
          args,
          undefined,
          undefined
        );
        return result;
      },
    };
  }

  private typeBoxToJsonSchema(schema: any): Record<string, unknown> {
    // TypeBox schemas have a structure that can be converted to JSON Schema
    // This is a simplified conversion - full implementation would traverse the schema
    if (!schema) {
      return { type: "object", properties: {} };
    }

    // If it already looks like a JSON Schema, return as-is
    if (schema.type || schema.properties || schema.$schema) {
      return schema;
    }

    // Try to extract JSON Schema from TypeBox
    // TypeBox stores the schema in various ways depending on the version
    const jsonSchema = schema.toJSONSchema?.() || schema;

    return {
      type: "object",
      properties: jsonSchema.properties || {},
      required: jsonSchema.required || [],
    };
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const message = JSON.parse(trimmed);
        this.handleMessage(message);
      } catch (error) {
        console.error(`[MCP Server] Failed to parse message: ${trimmed}`);
      }
    }
  }

  private async handleMessage(message: any): Promise<void> {
    console.error(`[MCP Server] Received: ${message.method || `response to ${message.id}`}`);

    try {
      // Handle requests
      if (message.method) {
        const response = await this.handleRequest(message);
        this.sendResponse(message.id, response);
      }
    } catch (error) {
      console.error(`[MCP Server] Error handling message:`, error);
      if (message.id !== undefined) {
        this.sendError(message.id, error);
      }
    }
  }

  private async handleRequest(message: any): Promise<any> {
    switch (message.method) {
      case "initialize":
        return this.handleInitialize(message.params);

      case "tools/list":
        return this.handleToolsList();

      case "tools/call":
        return this.handleToolsCall(message.params);

      case "resources/list":
        return { resources: [] };

      case "prompts/list":
        return { prompts: [] };

      default:
        throw new MCPError(
          `Unknown method: ${message.method}`,
          MCPErrorCode.PROTOCOL_ERROR
        );
    }
  }

  private handleInitialize(params: any): any {
    console.error(`[MCP Server] Initialize from client: ${params?.clientInfo?.name || "unknown"}`);

    return {
      protocolVersion: "2024-11-05",
      serverInfo: {
        name: this.name,
        version: this.version,
      },
      capabilities: {
        tools: {},
      },
    };
  }

  private handleToolsList(): any {
    const tools = Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));

    return { tools };
  }

  private async handleToolsCall(params: any): Promise<MCPToolResult> {
    const { name, arguments: args } = params;
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }

    try {
      console.error(`[MCP Server] Executing tool: ${name}`);
      const result = await tool.execute(args || {});

      // Convert AgentToolResult to MCP result
      if (result && typeof result === "object" && "content" in result) {
        const agentResult = result as any;
        const content: MCPToolResult["content"] = [];

        for (const item of agentResult.content || []) {
          if (item.type === "text") {
            content.push({ type: "text", text: item.text });
          } else if (item.type === "image") {
            content.push({
              type: "text",
              text: `[Image: ${item.mimeType}, ${item.data.length} bytes]`,
            });
          }
        }

        return {
          content,
          isError: agentResult.isError || false,
        };
      }

      // Fallback: stringify result
      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error(`[MCP Server] Tool execution failed:`, error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private sendResponse(id: number | string, result: any): void {
    const response = {
      jsonrpc: "2.0",
      id,
      result,
    };

    process.stdout.write(JSON.stringify(response) + "\n");
  }

  private sendError(id: number | string, error: unknown): void {
    const response = {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32000,
        message: error instanceof Error ? error.message : String(error),
      },
    };

    process.stdout.write(JSON.stringify(response) + "\n");
  }
}

/**
 * Create an MCP server from tools.
 *
 * @example
 * ```typescript
 * const server = createMCPServer({
 *   name: "My Tools",
 *   tools: [bashTool, readTool, writeTool],
 * });
 *
 * await server.startStdio();
 * ```
 */
export function createMCPServer(options: MCPServerOptions): MCPServer {
  return new MCPServer(options);
}
