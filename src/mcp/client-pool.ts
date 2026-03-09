/**
 * MCP Client Pool
 *
 * Manages multiple MCP client connections.
 * Provides centralized lifecycle management.
 *
 * Reference: @mastra/mcp packages/mcp/src/client/configuration.ts MCPClient class
 */

import { MCPClient } from "./client.js";
import type { MCPConnectionOptions, MCPToolDefinition, MCPResource, MCPPrompt } from "./types.js";
import { MCPError, MCPErrorCode } from "./errors.js";

/**
 * Options for creating an MCP client pool.
 */
export interface MCPClientPoolOptions {
  /** List of server configurations */
  servers: MCPConnectionOptions[];
}

/**
 * Status of a connected server.
 */
export interface MCPServerStatus {
  /** Server name */
  name: string;
  /** Whether connected */
  connected: boolean;
  /** Number of tools available */
  toolCount?: number;
  /** Number of resources available */
  resourceCount?: number;
  /** Number of prompts available */
  promptCount?: number;
}

/**
 * MCP Client Pool - manages multiple MCP server connections.
 *
 * @example
 * ```typescript
 * const pool = new MCPClientPool({
 *   servers: [
 *     { name: "filesystem", config: { command: "npx", args: ["-y", "@modelcontextprotocol/server-filesystem", "."] } },
 *     { name: "github", config: { command: "npx", args: ["-y", "@modelcontextprotocol/server-github"] } },
 *   ],
 * });
 *
 * await pool.connectAll();
 * const status = pool.getStatus();
 * await pool.disconnectAll();
 * ```
 */
export class MCPClientPool {
  private clients = new Map<string, MCPClient>();
  private isConnecting = false;

  constructor(private options: MCPClientPoolOptions) {}

  /**
   * Connect to all configured servers.
   *
   * Errors for individual servers are logged but don't fail the entire operation.
   */
  async connectAll(): Promise<void> {
    if (this.isConnecting) {
      throw new MCPError(
        "Already connecting to servers",
        MCPErrorCode.CONNECTION_FAILED
      );
    }

    this.isConnecting = true;

    try {
      for (const serverConfig of this.options.servers) {
        try {
          const client = new MCPClient(serverConfig);
          await client.connect();
          this.clients.set(serverConfig.name, client);
          console.log(`[MCP] Connected to ${serverConfig.name}`);
        } catch (error) {
          console.error(
            `[MCP] Failed to connect to ${serverConfig.name}:`,
            error instanceof Error ? error.message : String(error)
          );
          // Continue with other servers - don't fail entirely
        }
      }
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from all servers.
   */
  async disconnectAll(): Promise<void> {
    for (const [name, client] of this.clients) {
      try {
        await client.disconnect();
        console.log(`[MCP] Disconnected from ${name}`);
      } catch (error) {
        console.error(`[MCP] Error disconnecting from ${name}:`, error);
      }
    }
    this.clients.clear();
  }

  /**
   * Get a specific client by name.
   */
  getClient(name: string): MCPClient | undefined {
    return this.clients.get(name);
  }

  /**
   * Get all connected clients.
   */
  getAllClients(): MCPClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Check if a client is connected.
   */
  isConnected(name: string): boolean {
    return this.clients.get(name)?.connected ?? false;
  }

  /**
   * Get status of all servers.
   */
  async getStatus(): Promise<MCPServerStatus[]> {
    const statuses: MCPServerStatus[] = [];

    for (const [name, client] of this.clients) {
      const status: MCPServerStatus = {
        name,
        connected: client.connected,
      };

      if (client.connected) {
        try {
          const tools = await client.listTools();
          status.toolCount = tools.length;
        } catch {
          // Ignore errors
        }

        try {
          const resources = await client.listResources();
          status.resourceCount = resources.length;
        } catch {
          // Ignore errors
        }

        try {
          const prompts = await client.listPrompts();
          status.promptCount = prompts.length;
        } catch {
          // Ignore errors
        }
      }

      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Get all tools from all connected servers.
   */
  async listAllTools(): Promise<Record<string, MCPToolDefinition[]>> {
    const allTools: Record<string, MCPToolDefinition[]> = {};

    for (const [name, client] of this.clients) {
      if (client.connected) {
        try {
          allTools[name] = await client.listTools();
        } catch (error) {
          console.error(`[MCP] Failed to list tools from ${name}:`, error);
          allTools[name] = [];
        }
      }
    }

    return allTools;
  }

  /**
   * Get all resources from all connected servers.
   */
  async listAllResources(): Promise<Record<string, MCPResource[]>> {
    const allResources: Record<string, MCPResource[]> = {};

    for (const [name, client] of this.clients) {
      if (client.connected) {
        try {
          allResources[name] = await client.listResources();
        } catch (error) {
          console.error(`[MCP] Failed to list resources from ${name}:`, error);
          allResources[name] = [];
        }
      }
    }

    return allResources;
  }

  /**
   * Get all prompts from all connected servers.
   */
  async listAllPrompts(): Promise<Record<string, MCPPrompt[]>> {
    const allPrompts: Record<string, MCPPrompt[]> = {};

    for (const [name, client] of this.clients) {
      if (client.connected) {
        try {
          allPrompts[name] = await client.listPrompts();
        } catch (error) {
          console.error(`[MCP] Failed to list prompts from ${name}:`, error);
          allPrompts[name] = [];
        }
      }
    }

    return allPrompts;
  }

  /**
   * Reload all connections.
   */
  async reload(): Promise<void> {
    await this.disconnectAll();
    await this.connectAll();
  }

  /**
   * Add a new server connection.
   */
  async addServer(config: MCPConnectionOptions): Promise<boolean> {
    if (this.clients.has(config.name)) {
      console.warn(`[MCP] Server ${config.name} already exists`);
      return false;
    }

    try {
      const client = new MCPClient(config);
      await client.connect();
      this.clients.set(config.name, client);
      console.log(`[MCP] Connected to ${config.name}`);
      return true;
    } catch (error) {
      console.error(`[MCP] Failed to connect to ${config.name}:`, error);
      return false;
    }
  }

  /**
   * Remove a server connection.
   */
  async removeServer(name: string): Promise<boolean> {
    const client = this.clients.get(name);
    if (!client) {
      return false;
    }

    try {
      await client.disconnect();
      this.clients.delete(name);
      console.log(`[MCP] Disconnected from ${name}`);
      return true;
    } catch (error) {
      console.error(`[MCP] Error disconnecting from ${name}:`, error);
      return false;
    }
  }
}
