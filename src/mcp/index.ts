/**
 * MCP Module - Public Exports
 *
 * This module provides Model Context Protocol (MCP) support for new_indusagi.
 * It allows connecting to MCP servers and using their tools as AgentTools.
 *
 * @example
 * ```typescript
 * import { MCPClient, MCPClientPool, loadMCPConfig } from "new_indusagi/mcp";
 * import { ToolRegistry } from "new_indusagi/agent";
 *
 * // Load config from file
 * const configs = loadMCPConfig(process.cwd());
 *
 * // Create a client pool
 * const pool = new MCPClientPool({ servers: configs });
 * await pool.connectAll();
 *
 * // Register tools
 * const registry = new ToolRegistry();
 * for (const client of pool.getAllClients()) {
 *   const tools = await client.listTools();
 *   await registerMCPToolsInRegistry(registry, client, tools);
 * }
 * ```
 */

// Internal imports for use in this module
import { MCPClientPool } from "./client-pool.js";
import { loadMCPConfig } from "./config.js";
import { registerMCPToolsInRegistry } from "./tool-factory.js";

// Client components
export { MCPClient, type MCPClientOptions } from "./client.js";
export { MCPClientPool, type MCPClientPoolOptions, type MCPServerStatus } from "./client-pool.js";

// Server component
export { MCPServer, createMCPServer, type MCPServerOptions } from "./server.js";

// Tool factory
export {
  createMCPAgentToolFactory,
  registerMCPToolsInRegistry,
  createMCPToolsMap,
  createMCPToolsRecord,
  type MCPToolClient,
} from "./tool-factory.js";

// Schema conversion
export {
  jsonSchemaToTypeBox,
  applyPassthrough,
  convertMCPInputSchema,
  convertMCPOutputSchema,
} from "./schema-converter.js";

// Configuration
export {
  loadMCPConfig,
  getUserConfigPath,
  getProjectConfigPath,
  ensureUserConfigDir,
  ensureProjectConfigDir,
  saveConfig,
  saveUserConfig,
  saveProjectConfig,
  createDefaultConfig,
  EXAMPLE_CONFIG,
} from "./config.js";

// Errors
export {
  MCPError,
  MCPErrorCode,
  isMCPError,
  isSessionError,
  createConnectionError,
  createTimeoutError,
  createToolNotFoundError,
  createInvalidParametersError,
  createServerError,
  createNotConnectedError,
  createConfigError,
  createSchemaConversionError,
} from "./errors.js";

// Types
export type {
  // Server configuration
  StdioServerConfig,
  HttpServerConfig,
  MCPServerConfig,
  MCPConnectionOptions,
  // Protocol types
  MCPToolDefinition,
  MCPResource,
  MCPPrompt,
  MCPInitializeResult,
  // Client state
  MCPClientState,
  // Tool execution
  MCPToolCallRequest,
  MCPContentBlock,
  MCPToolCallResult,
  // Configuration file
  MCPServerConfigEntry,
  MCPConfigFile,
  // Logging
  MCPLoggingLevel,
  MCPLogMessage,
  MCPLogHandler,
  // Progress
  MCPProgressNotification,
  MCPProgressHandler,
  // Elicitation
  MCPElicitRequest,
  MCPElicitResult,
  MCPElicitationHandler,
  // Roots
  MCPRoot,
  // Base options
  BaseServerOptions,
} from "./types.js";

/**
 * Convenience function: Initialize MCP and register tools.
 *
 * This is the simplest way to add MCP support to an agent.
 *
 * @example
 * ```typescript
 * import { initializeMCP } from "new_indusagi/mcp";
 * import { ToolRegistry, Agent } from "new_indusagi/agent";
 *
 * const registry = new ToolRegistry();
 * const { pool, toolCount } = await initializeMCP(registry, process.cwd());
 *
 * console.log(`Connected to ${pool.getAllClients().length} servers with ${toolCount} tools`);
 * ```
 */
export async function initializeMCP(
  registry: import("../agent/tools/registry.js").ToolRegistry,
  cwd: string = process.cwd()
): Promise<{ pool: MCPClientPool; toolCount: number }> {
  const configs = loadMCPConfig(cwd);

  if (configs.length === 0) {
    console.log("[MCP] No servers configured");
    return { pool: new MCPClientPool({ servers: [] }), toolCount: 0 };
  }

  const pool = new MCPClientPool({ servers: configs });
  await pool.connectAll();

  let totalTools = 0;

  // Register tools from all connected clients
  for (const client of pool.getAllClients()) {
    try {
      const tools = await client.listTools();
      const count = await registerMCPToolsInRegistry(registry, client, tools);
      totalTools += count;
      console.log(`[MCP] Registered ${count} tools from ${client.serverName}`);
    } catch (error) {
      console.error(`[MCP] Failed to register tools from ${client.serverName}:`, error);
    }
  }

  return { pool, toolCount: totalTools };
}
