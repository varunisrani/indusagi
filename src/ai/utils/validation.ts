import AjvModule from "ajv";
import addFormatsModule from "ajv-formats";

// Handle both default and named exports
const Ajv = (AjvModule as any).default || AjvModule;
const addFormats = (addFormatsModule as any).default || addFormatsModule;

import type { Tool, ToolCall } from "../types.js";
import { sanitizeUnknownUnicode } from "./sanitize-unicode.js";
import { normalizeSchemaForValidation } from "./typebox-helpers.js";

// Detect if we're in a browser extension environment with strict CSP
// Chrome extensions with Manifest V3 don't allow eval/Function constructor
const isBrowserExtension = typeof globalThis !== "undefined" && (globalThis as any).chrome?.runtime?.id !== undefined;

// Create a singleton AJV instance with formats (only if not in browser extension)
// AJV requires 'unsafe-eval' CSP which is not allowed in Manifest V3
let ajv: any = null;
if (!isBrowserExtension) {
	try {
		ajv = new Ajv({
			allErrors: true,
			strict: false,
			coerceTypes: true,
		});
		addFormats(ajv);
	} catch (_e) {
		// AJV initialization failed (likely CSP restriction)
		console.warn("AJV validation disabled due to CSP restrictions");
	}
}

const validatorCache = new WeakMap<object, any>();
let validatorCacheEntries = 0;

export interface ValidationDiagnostics {
	cacheSize: number;
	ajvEnabled: boolean;
	isBrowserExtension: boolean;
}

/**
 * Finds a tool by name and validates the tool call arguments against its TypeBox schema
 * @param tools Array of tool definitions
 * @param toolCall The tool call from the LLM
 * @returns The validated arguments
 * @throws Error if tool is not found or validation fails
 */
export function validateToolCall(tools: Tool[], toolCall: ToolCall): any {
	const tool = tools.find((t) => t.name === toolCall.name);
	if (!tool) {
		throw new Error(`Tool "${toolCall.name}" not found`);
	}
	return validateToolArguments(tool, toolCall);
}

/**
 * Validates tool call arguments against the tool's TypeBox schema
 * @param tool The tool definition with TypeBox schema
 * @param toolCall The tool call from the LLM
 * @returns The validated (and potentially coerced) arguments
 * @throws Error with formatted message if validation fails
 */
export function validateToolArguments(tool: Tool, toolCall: ToolCall): any {
	// Skip validation in browser extension environment (CSP restrictions prevent AJV from working)
	if (!ajv || isBrowserExtension) {
		return toolCall.arguments;
	}

	const schemaObj = tool.parameters as unknown as object;
	let validate = validatorCache.get(schemaObj);
	if (!validate) {
		const normalizedSchema = normalizeSchemaForValidation(tool.parameters as any);
		validate = ajv.compile(normalizedSchema);
		validatorCache.set(schemaObj, validate);
		validatorCacheEntries += 1;
	}

	// Clone + sanitize arguments so AJV can safely mutate for type coercion
	const args = sanitizeUnknownUnicode(structuredClone(toolCall.arguments));

	if (validate(args)) {
		return args;
	}

	const errors =
		validate.errors
			?.map((err: any) => {
				const path = err.instancePath ? err.instancePath.substring(1) : err.params.missingProperty || "root";
				const keyword = err.keyword ? ` (${err.keyword})` : "";
				return `  - ${path}: ${err.message}${keyword}`;
			})
			.join("\n") || "Unknown validation error";

	const errorMessage = `Validation failed for tool "${toolCall.name}":\n${errors}\n\nReceived arguments:\n${JSON.stringify(toolCall.arguments, null, 2)}`;

	throw new Error(errorMessage);
}

export function getValidationDiagnostics(): ValidationDiagnostics {
	return {
		cacheSize: validatorCacheEntries,
		ajvEnabled: !!ajv,
		isBrowserExtension,
	};
}
