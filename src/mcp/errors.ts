/**
 * MCP Error Types
 *
 * Reference: @mastra/core error handling patterns
 */

/**
 * Error codes for MCP operations.
 */
export enum MCPErrorCode {
  /** Failed to connect to MCP server */
  CONNECTION_FAILED = "CONNECTION_FAILED",
  /** Request timed out */
  TIMEOUT = "TIMEOUT",
  /** Tool not found on server */
  TOOL_NOT_FOUND = "TOOL_NOT_FOUND",
  /** Invalid parameters for tool call */
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  /** Server returned an error */
  SERVER_ERROR = "SERVER_ERROR",
  /** Transport layer error */
  TRANSPORT_ERROR = "TRANSPORT_ERROR",
  /** Not connected to server */
  NOT_CONNECTED = "NOT_CONNECTED",
  /** Protocol error */
  PROTOCOL_ERROR = "PROTOCOL_ERROR",
  /** Configuration error */
  CONFIG_ERROR = "CONFIG_ERROR",
  /** Schema conversion error */
  SCHEMA_CONVERSION_ERROR = "SCHEMA_CONVERSION_ERROR",
  /** Resource not found */
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  /** Prompt not found */
  PROMPT_NOT_FOUND = "PROMPT_NOT_FOUND",
  /** Session error (requires reconnection) */
  SESSION_ERROR = "SESSION_ERROR",
}

/**
 * Error class for MCP operations.
 * Provides structured error information with error codes and details.
 */
export class MCPError extends Error {
  /** Error code */
  readonly code: MCPErrorCode;
  /** Additional error details */
  readonly details?: unknown;
  /** Server name where error occurred */
  readonly serverName?: string;
  /** Tool name if error occurred during tool execution */
  readonly toolName?: string;

  constructor(
    message: string,
    code: MCPErrorCode,
    details?: unknown,
    options?: { serverName?: string; toolName?: string; cause?: Error }
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "MCPError";
    this.code = code;
    this.details = details;
    this.serverName = options?.serverName;
    this.toolName = options?.toolName;
  }

  /**
   * Convert error to JSON for logging/serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      serverName: this.serverName,
      toolName: this.toolName,
    };
  }

  /**
   * Create a string representation of the error.
   */
  override toString(): string {
    let str = `${this.name} [${this.code}]: ${this.message}`;
    if (this.serverName) str += ` (server: ${this.serverName})`;
    if (this.toolName) str += ` (tool: ${this.toolName})`;
    return str;
  }
}

/**
 * Type guard to check if an error is an MCPError.
 */
export function isMCPError(error: unknown): error is MCPError {
  return error instanceof MCPError;
}

/**
 * Check if an error indicates a session problem requiring reconnection.
 */
export function isSessionError(error: unknown): boolean {
  if (!isMCPError(error)) return false;
  return error.code === MCPErrorCode.SESSION_ERROR || error.code === MCPErrorCode.NOT_CONNECTED;
}

/**
 * Create a connection failed error.
 */
export function createConnectionError(serverName: string, cause?: Error): MCPError {
  return new MCPError(
    `Failed to connect to MCP server: ${serverName}`,
    MCPErrorCode.CONNECTION_FAILED,
    { cause: cause?.message },
    { serverName, cause }
  );
}

/**
 * Create a timeout error.
 */
export function createTimeoutError(operation: string, serverName?: string): MCPError {
  return new MCPError(`Operation timed out: ${operation}`, MCPErrorCode.TIMEOUT, { operation }, { serverName });
}

/**
 * Create a tool not found error.
 */
export function createToolNotFoundError(toolName: string, serverName?: string): MCPError {
  return new MCPError(`Tool not found: ${toolName}`, MCPErrorCode.TOOL_NOT_FOUND, { toolName }, { serverName, toolName });
}

/**
 * Create an invalid parameters error.
 */
export function createInvalidParametersError(toolName: string, details: unknown, serverName?: string): MCPError {
  return new MCPError(
    `Invalid parameters for tool: ${toolName}`,
    MCPErrorCode.INVALID_PARAMETERS,
    details,
    { serverName, toolName }
  );
}

/**
 * Create a server error.
 */
export function createServerError(message: string, serverName?: string, details?: unknown): MCPError {
  return new MCPError(message, MCPErrorCode.SERVER_ERROR, details, { serverName });
}

/**
 * Create a not connected error.
 */
export function createNotConnectedError(serverName?: string): MCPError {
  return new MCPError("Not connected to MCP server", MCPErrorCode.NOT_CONNECTED, undefined, { serverName });
}

/**
 * Create a config error.
 */
export function createConfigError(message: string, details?: unknown): MCPError {
  return new MCPError(message, MCPErrorCode.CONFIG_ERROR, details);
}

/**
 * Create a schema conversion error.
 */
export function createSchemaConversionError(toolName: string, details: unknown, serverName?: string): MCPError {
  return new MCPError(
    `Failed to convert schema for tool: ${toolName}`,
    MCPErrorCode.SCHEMA_CONVERSION_ERROR,
    details,
    { serverName, toolName }
  );
}
