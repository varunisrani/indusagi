import type { StopReason } from "../types.js";

export function normalizeToolCallId(id: string, maxLengthOrModel?: number | unknown, ..._rest: unknown[]): string {
	const maxLength = typeof maxLengthOrModel === "number" ? maxLengthOrModel : 64;
	return id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, maxLength);
}

export function mapStopReason(reason: string | null | undefined, provider?: string): StopReason {
	if (!reason) return "stop";

	switch (reason) {
		case "end_turn":
		case "stop":
		case "STOP":
		case "stop_sequence":
			return "stop";
		case "max_tokens":
		case "length":
		case "MAX_TOKENS":
			return "length";
		case "tool_use":
		case "tool_calls":
		case "function_call":
		case "TOOL_USE":
			return "toolUse";
		case "content_filter":
		case "refusal":
			return "error";
	}

	if (provider === "bedrock") {
		if (reason.includes("CONTEXT_WINDOW")) return "length";
	}

	return "error";
}
