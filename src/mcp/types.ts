/**
 * MCP Type Definitions
 *
 * Aligned with Model Context Protocol specification
 * Reference: @mastra/mcp packages/mcp/src/client/types.ts
 */

// ============================================================================
// Server Configuration
// ============================================================================

/**
 * Configuration for MCP servers using stdio (subprocess) transport.
 * Used when the MCP server is spawned as a subprocess that communicates via stdin/stdout.
 */
export interface StdioServerConfig {
  /** Command to execute (e.g., 'node', 'python', 'npx') */
  command: string;
  /** Optional arguments to pass to the command */
  args?: string[];
  /** Optional environment variables for the subprocess */
  env?: Record<string, string>;
  /** Optional working directory for the subprocess */
  cwd?: string;
}

/**
 * Configuration for MCP servers using HTTP-based transport (Streamable HTTP or SSE fallback).
 * Used when connecting to remote MCP servers over HTTP.
 */
export interface HttpServerConfig {
  /** URL of the MCP server endpoint */
  url: URL;
  /** Optional headers for HTTP requests */
  headers?: Record<string, string>;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
}

/**
 * Configuration for connecting to an MCP server.
 * Either stdio-based (subprocess) or HTTP-based (remote server).
 */
export type MCPServerConfig = StdioServerConfig | HttpServerConfig;

/**
 * Options for establishing an MCP connection.
 */
export interface MCPConnectionOptions {
  /** Unique name for this server connection */
  name: string;
  /** Server configuration (stdio or HTTP) */
  config: MCPServerConfig;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

// ============================================================================
// MCP Protocol Types
// ============================================================================

/**
 * Definition of a tool exposed by an MCP server.
 */
export interface MCPToolDefinition {
  /** Tool name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** JSON Schema for input parameters */
  inputSchema: Record<string, unknown>;
  /** Optional JSON Schema for output */
  outputSchema?: Record<string, unknown>;
}

/**
 * Resource exposed by an MCP server.
 */
export interface MCPResource {
  /** Unique URI for this resource */
  uri: string;
  /** Human-readable name */
  name?: string;
  /** MIME type of the resource content */
  mimeType?: string;
  /** Description of the resource */
  description?: string;
}

/**
 * Prompt template exposed by an MCP server.
 */
export interface MCPPrompt {
  /** Prompt name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Arguments the prompt accepts */
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

/**
 * Result of MCP server initialization.
 */
export interface MCPInitializeResult {
  /** Protocol version supported by the server */
  protocolVersion: string;
  /** Server information */
  serverInfo: {
    name: string;
    version?: string;
  };
  /** Server capabilities */
  capabilities: Record<string, unknown>;
}

// ============================================================================
// Client State
// ============================================================================

/**
 * Current state of an MCP client connection.
 */
export interface MCPClientState {
  /** Whether the client is connected */
  connected: boolean;
  /** Name of the connected server */
  serverName: string;
  /** Tools available from the server */
  tools: MCPToolDefinition[];
  /** Resources available from the server */
  resources: MCPResource[];
  /** Prompts available from the server */
  prompts: MCPPrompt[];
}

// ============================================================================
// Tool Execution
// ============================================================================

/**
 * Request to call an MCP tool.
 */
export interface MCPToolCallRequest {
  /** Tool name */
  name: string;
  /** Tool arguments */
  arguments: Record<string, unknown>;
}

/**
 * Content block in an MCP tool call result.
 */
export type MCPContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; resource: MCPResource };

/**
 * Result of an MCP tool call.
 */
export interface MCPToolCallResult {
  /** Content blocks returned by the tool */
  content: MCPContentBlock[];
  /** Whether the tool execution resulted in an error */
  isError?: boolean;
  /** Structured content if the tool has an output schema */
  structuredContent?: unknown;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Server configuration in the MCP config file.
 */
export interface MCPServerConfigEntry {
  /** Unique name for this server */
  name: string;
  /** Command for stdio transport */
  command?: string;
  /** Arguments for stdio transport */
  args?: string[];
  /** Environment variables for stdio transport */
  env?: Record<string, string>;
  /** URL for HTTP transport */
  url?: string;
  /** Headers for HTTP transport */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether this server is enabled (default: true) */
  enabled?: boolean;
}

/**
 * Server configuration without name (for object format).
 */
export interface MCPServerConfigValue {
  /** Command for stdio transport */
  command?: string;
  /** Arguments for stdio transport */
  args?: string[];
  /** Environment variables for stdio transport */
  env?: Record<string, string>;
  /** URL for HTTP transport */
  url?: string;
  /** Headers for HTTP transport */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Whether this server is enabled (default: true) */
  enabled?: boolean;
}

/**
 * MCP configuration file structure.
 * Supports two formats:
 * - Array: { "servers": [{ "name": "github", "command": "npx", ... }] }
 * - Object: { "servers": { "github": { "command": "npx", ... } } }
 */
export interface MCPConfigFile {
  /** Server configurations (array or object with server names as keys) */
  servers: MCPServerConfigEntry[] | Record<string, MCPServerConfigValue>;
}

// ============================================================================
// Logging
// ============================================================================

/**
 * MCP logging levels.
 */
export type MCPLoggingLevel = "debug" | "info" | "notice" | "warning" | "error" | "critical" | "alert" | "emergency";

/**
 * Log message from an MCP server.
 */
export interface MCPLogMessage {
  /** Logging level */
  level: MCPLoggingLevel;
  /** Log message content */
  message: string;
  /** Timestamp */
  timestamp: Date;
  /** Server name */
  serverName: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * Handler function for processing log messages from MCP servers.
 */
export type MCPLogHandler = (logMessage: MCPLogMessage) => void;

// ============================================================================
// Progress
// ============================================================================

/**
 * Progress notification from an MCP server.
 */
export interface MCPProgressNotification {
  /** Progress token */
  progressToken: string | number;
  /** Current progress value */
  progress: number;
  /** Total value (optional) */
  total?: number;
  /** Human-readable message */
  message?: string;
}

/**
 * Handler function for processing progress notifications.
 */
export type MCPProgressHandler = (params: MCPProgressNotification) => void;

// ============================================================================
// Elicitation
// ============================================================================

/**
 * Elicitation request from an MCP server (requesting user input).
 */
export interface MCPElicitRequest {
  /** Message to display to the user */
  message: string;
  /** JSON Schema for the expected response */
  requestedSchema: Record<string, unknown>;
}

/**
 * Response to an elicitation request.
 */
export interface MCPElicitResult {
  /** Action taken: accept, decline, or cancel */
  action: "accept" | "decline" | "cancel";
  /** Content if action is accept */
  content?: Record<string, unknown>;
}

/**
 * Handler function for processing elicitation requests.
 */
export type MCPElicitationHandler = (request: MCPElicitRequest) => Promise<MCPElicitResult>;

// ============================================================================
// Roots (filesystem access)
// ============================================================================

/**
 * Filesystem root exposed to MCP servers.
 */
export interface MCPRoot {
  /** Unique URI (must be file://) */
  uri: string;
  /** Human-readable name */
  name?: string;
}

// ============================================================================
// Base Server Options
// ============================================================================

/**
 * Base options common to all MCP server definitions.
 */
export interface BaseServerOptions {
  /** Optional handler for server log messages */
  logger?: MCPLogHandler;
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Whether to enable server log forwarding (default: true) */
  enableServerLogs?: boolean;
  /** Whether to enable progress tracking (default: false) */
  enableProgressTracking?: boolean;
  /** List of filesystem roots to expose to the MCP server */
  roots?: MCPRoot[];
}
