/**
 * Shared error handling utilities for provider streaming.
 */

import type { StopReason } from "../types.js";

/**
 * Standardized error codes for provider errors.
 */
export enum ProviderErrorCode {
	/** Authentication failed (invalid API key). */
	AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",

	/** Rate limit exceeded. */
	RATE_LIMITED = "RATE_LIMITED",

	/** Request timed out. */
	TIMEOUT = "TIMEOUT",

	/** Network connection error. */
	NETWORK_ERROR = "NETWORK_ERROR",

	/** Invalid request parameters. */
	INVALID_REQUEST = "INVALID_REQUEST",

	/** Provider service unavailable. */
	SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

	/** Content policy violation. */
	CONTENT_FILTERED = "CONTENT_FILTERED",

	/** Unknown or unexpected error. */
	UNKNOWN = "UNKNOWN",
}

/**
 * Standardized provider error.
 */
export class ProviderError extends Error {
	constructor(
		message: string,
		public readonly code: ProviderErrorCode,
		public readonly originalError?: unknown,
	) {
		super(message);
		this.name = "ProviderError";
	}
}

/**
 * Map provider-specific stop reason to standardized StopReason.
 */
export function mapProviderStopReason(reason: string | null | undefined, provider: string): StopReason {
	if (!reason) return "stop";

	const lower = reason.toLowerCase();

	switch (lower) {
		case "stop":
		case "end_turn":
		case "stop_sequence":
			return "stop";
		case "max_tokens":
		case "length":
			return "length";
		case "tool_use":
		case "tool_calls":
		case "function_call":
			return "toolUse";
		case "content_filter":
		case "refusal":
		case "safety":
			return "error";
		default:
			return "error";
	}
}

/**
 * Create a standardized error response message.
 */
export function formatProviderError(error: unknown, providerName: string): string {
	if (error instanceof ProviderError) {
		return `[${providerName}] ${error.message} (${error.code})`;
	}
	if (error instanceof Error) {
		return `[${providerName}] ${error.message}`;
	}
	return `[${providerName}] Unknown error: ${String(error)}`;
}

/**
 * Check if an error is retryable.
 */
export function isRetryableError(error: unknown): boolean {
	if (error instanceof ProviderError) {
		switch (error.code) {
			case ProviderErrorCode.RATE_LIMITED:
			case ProviderErrorCode.TIMEOUT:
			case ProviderErrorCode.NETWORK_ERROR:
			case ProviderErrorCode.SERVICE_UNAVAILABLE:
				return true;
			default:
				return false;
		}
	}
	if (error instanceof Error) {
		const msg = error.message.toLowerCase();
		return (
			msg.includes("rate limit") ||
			msg.includes("timeout") ||
			msg.includes("network") ||
			msg.includes("econnreset") ||
			msg.includes("etimedout")
		);
	}
	return false;
}
