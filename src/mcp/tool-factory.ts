/**
 * MCP Tool Factory
 *
 * Creates AgentTool instances from MCP tool definitions.
 * Uses the factory pattern to match new_indusagi's ToolRegistry.
 *
 * Reference: @mastra/mcp packages/mcp/src/client/client.ts tools() method
 */

import type { TSchema, Static } from "@sinclair/typebox";
import type { AgentTool, AgentToolResult, AgentToolUpdateCallback } from "../agent/types.js";
import type { MCPToolDefinition, MCPToolCallResult } from "./types.js";
import { convertMCPInputSchema } from "./schema-converter.js";
import { MCPError, MCPErrorCode, isMCPError } from "./errors.js";

/**
 * Interface for MCP client that can call tools.
 */
export interface MCPToolClient {
  /** Server name */
  readonly serverName: string;
  /** Whether client is connected */
  readonly connected: boolean;
  /** Call a tool on the MCP server */
  callTool(name: string, args: Record<string, unknown>): Promise<MCPToolCallResult>;
}

/**
 * Create an AgentTool from an MCP tool definition.
 *
 * This function creates a factory that matches ToolRegistry's pattern.
 * The tool is namespaced with the server name to avoid conflicts.
 *
 * @param mcpTool - MCP tool definition from the server
 * @param client - MCP client to use for tool execution
 * @returns Factory function that creates an AgentTool
 */
export function createMCPAgentToolFactory(
  mcpTool: MCPToolDefinition,
  client: MCPToolClient
): () => AgentTool<TSchema, MCPToolCallResult> {
  return () => {
    // Namespace the tool name to avoid conflicts between servers
    const namespacedName = `${client.serverName}_${mcpTool.name}`;

    // Convert JSON Schema to TypeBox schema
    const parameters = convertMCPInputSchema(mcpTool.inputSchema);

    return {
      name: namespacedName,
      label: mcpTool.name,
      description: `[${client.serverName}] ${mcpTool.description || ""}`,
      category: "mcp",
      parameters,

      execute: async (
        toolCallId: string,
        params: any,
        signal?: AbortSignal,
        onUpdate?: AgentToolUpdateCallback<MCPToolCallResult>
      ): Promise<AgentToolResult<MCPToolCallResult>> => {
        const typedParams = params as Record<string, unknown>;
        try {
          // Check connection
          if (!client.connected) {
            throw new MCPError(
              `MCP server ${client.serverName} not connected`,
              MCPErrorCode.NOT_CONNECTED,
              undefined,
              { serverName: client.serverName, toolName: mcpTool.name }
            );
          }

          // Check for abort signal
          if (signal?.aborted) {
            throw new MCPError(
              "Tool execution aborted",
              MCPErrorCode.TIMEOUT,
              undefined,
              { serverName: client.serverName, toolName: mcpTool.name }
            );
          }

          // Call the tool via MCP
          const result = await client.callTool(mcpTool.name, typedParams);

          // Convert MCP result to AgentToolResult
          return convertMCPResultToAgentResult(result, client.serverName, mcpTool.name);
        } catch (error) {
          // Handle MCP errors
          if (error instanceof MCPError) {
            return {
              content: [
                {
                  type: "text",
                  text: `MCP Error: ${error.message}`,
                },
              ],
              details: {
                error: error.message,
                code: error.code,
                serverName: error.serverName,
                toolName: error.toolName,
              } as unknown as MCPToolCallResult,
              isError: true,
            };
          }

          // Handle abort errors
          if (error instanceof Error && error.name === "AbortError") {
            return {
              content: [
                {
                  type: "text",
                  text: `Tool execution aborted`,
                },
              ],
              details: {
                error: "Aborted",
              } as unknown as MCPToolCallResult,
              isError: true,
            };
          }

          // Handle other errors
          return {
            content: [
              {
                type: "text",
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
              },
            ],
            details: {
              error: String(error),
            } as unknown as MCPToolCallResult,
            isError: true,
          };
        }
      },
    };
  };
}

/**
 * Truncate text to a maximum number of lines for display.
 */
function truncateTextForDisplay(text: string, maxLines: number = 4, maxChars: number = 500): string {
  const lines = text.split('\n');
  
  // If already short enough, return as-is
  if (lines.length <= maxLines && text.length <= maxChars) {
    return text;
  }
  
  // Take first maxLines lines
  let truncated = lines.slice(0, maxLines).join('\n');
  
  // If still too long, truncate by chars
  if (truncated.length > maxChars) {
    truncated = truncated.slice(0, maxChars);
  }
  
  // Add truncation indicator
  const remaining = lines.length - maxLines;
  if (remaining > 0) {
    truncated += `\n... (${remaining} more lines)`;
  } else if (text.length > maxChars) {
    truncated += '...';
  }
  
  return truncated;
}

/**
 * Convert MCP tool call result to AgentToolResult.
 */
function convertMCPResultToAgentResult(
  result: MCPToolCallResult,
  serverName: string,
  toolName: string
): AgentToolResult<MCPToolCallResult> {
  const content: AgentToolResult<MCPToolCallResult>["content"] = [];

  // Handle structured result from MCP
  if (result.content && Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item.type === "text") {
        // Truncate text for display (keep full data in details)
        const truncatedText = truncateTextForDisplay(item.text);
        content.push({ type: "text", text: truncatedText });
      } else if (item.type === "image") {
        content.push({
          type: "image",
          data: item.data,
          mimeType: item.mimeType,
        });
      }
    }
  } else if (typeof result === "string") {
    const truncatedText = truncateTextForDisplay(result);
    content.push({ type: "text", text: truncatedText });
  } else {
    // Fallback: JSON stringify with truncation
    const jsonStr = JSON.stringify(result, null, 2);
    const truncatedText = truncateTextForDisplay(jsonStr);
    content.push({ type: "text", text: truncatedText });
  }

  return {
    content,
    details: result,
    isError: result.isError || false,
  };
}

/**
 * Register all MCP tools from a client into a ToolRegistry.
 *
 * This is the main integration point with new_indusagi's ToolRegistry.
 *
 * @param registry - ToolRegistry instance to register tools into
 * @param client - MCP client with tools to register
 * @param tools - List of tool definitions from the server
 * @returns Number of tools registered
 */
export async function registerMCPToolsInRegistry(
  registry: import("../agent/tools/registry.js").ToolRegistry,
  client: MCPToolClient,
  tools: MCPToolDefinition[]
): Promise<number> {
  let registeredCount = 0;

  for (const tool of tools) {
    try {
      const factory = createMCPAgentToolFactory(tool, client);

      registry.register(
        {
          name: `${client.serverName}_${tool.name}`,
          label: tool.name,
          category: "mcp",
          description: `[${client.serverName}] ${tool.description || ""}`,
        },
        factory
      );

      registeredCount++;
    } catch (error) {
      console.error(`Failed to register MCP tool ${tool.name}:`, error);
      // Continue with other tools
    }
  }

  return registeredCount;
}

/**
 * Create a map of AgentTools from MCP tool definitions.
 * Useful when you don't want to use the registry pattern.
 *
 * @param tools - List of tool definitions from the server
 * @param client - MCP client to use for tool execution
 * @returns Map of namespaced tool names to AgentTool instances
 */
export function createMCPToolsMap(
  tools: MCPToolDefinition[],
  client: MCPToolClient
): Map<string, AgentTool<TSchema, MCPToolCallResult>> {
  const toolMap = new Map<string, AgentTool<TSchema, MCPToolCallResult>>();

  for (const tool of tools) {
    const factory = createMCPAgentToolFactory(tool, client);
    const namespacedName = `${client.serverName}_${tool.name}`;
    toolMap.set(namespacedName, factory());
  }

  return toolMap;
}

/**
 * Create a record of AgentTools from MCP tool definitions.
 * Matches the format expected by Agent's tools property.
 *
 * @param tools - List of tool definitions from the server
 * @param client - MCP client to use for tool execution
 * @returns Record of namespaced tool names to AgentTool instances
 */
export function createMCPToolsRecord(
  tools: MCPToolDefinition[],
  client: MCPToolClient
): Record<string, AgentTool<TSchema, MCPToolCallResult>> {
  const toolRecord: Record<string, AgentTool<TSchema, MCPToolCallResult>> = {};

  for (const tool of tools) {
    const factory = createMCPAgentToolFactory(tool, client);
    const namespacedName = `${client.serverName}_${tool.name}`;
    toolRecord[namespacedName] = factory();
  }

  return toolRecord;
}
