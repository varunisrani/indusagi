import type { Tool } from "../types.js";

/**
 * Shared conversion helpers for tool schemas across providers.
 *
 * This module provides utilities for converting between generic tool definitions
 * and provider-specific tool schemas.
 */

/**
 * Normalize tool name to provider-specific format.
 *
 * @param name - Original tool name.
 * @param maxLength - Maximum length for the normalized name (default: 64).
 * @returns Normalized tool name.
 *
 * Default implementation removes special characters and truncates to maxLength.
 */
export function normalizeToolName(
	name: string,
	maxLength: number = 64,
): string {
	return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, maxLength);
}

/**
 * Provider-agnostic tool schema shape.
 */
export interface ProviderToolSchema {
	/** Tool name. */
	name: string;
	/** Tool description. */
	description: string;
	/** Tool parameters (JSON Schema). */
	parameters: unknown;
}

/**
 * Convert a generic tool to provider tool schema.
 *
 * @param tool - Generic tool definition.
 * @returns Provider-specific tool schema.
 */
export function toProviderTool(tool: Tool): ProviderToolSchema {
	return {
		name: tool.name,
		description: tool.description,
		parameters: tool.parameters,
	};
}

/**
 * Convert a provider tool schema back to generic tool.
 *
 * @param schema - Provider-specific tool schema.
 * @returns Generic tool definition.
 */
export function fromProviderTool(schema: ProviderToolSchema): Tool {
	return {
		name: schema.name,
		description: schema.description,
		parameters: schema.parameters as any,
	};
}

/**
 * Convert an array of generic tools to provider format.
 *
 * @param tools - Array of generic tool definitions.
 * @returns Array of provider-specific tool schemas.
 */
export function convertTools(tools: Tool[]): ProviderToolSchema[] {
	return tools.map(toProviderTool);
}
