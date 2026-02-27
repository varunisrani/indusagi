import type { AssistantMessage } from "../types.js";

export interface OverflowPatternConfig {
	pattern: RegExp;
	suggestion: string;
}

export const OVERFLOW_PATTERN_CONFIG: OverflowPatternConfig[] = [
	{ pattern: /prompt is too long/i, suggestion: "Trim prior messages or reduce system prompt size." },
	{ pattern: /input is too long for requested model/i, suggestion: "Use a larger context model or shorten history." },
	{ pattern: /exceeds the context window/i, suggestion: "Drop old turns and retry with summarized context." },
	{ pattern: /input token count.*exceeds the maximum/i, suggestion: "Reduce attachments or split the request." },
	{ pattern: /maximum prompt length is \d+/i, suggestion: "Decrease prompt/tool-result verbosity." },
	{ pattern: /reduce the length of the messages/i, suggestion: "Compress or summarize conversation state." },
	{ pattern: /maximum context length is \d+ tokens/i, suggestion: "Select a provider/model with larger window." },
	{ pattern: /exceeds the limit of \d+/i, suggestion: "Remove large blocks in latest user/tool messages." },
	{ pattern: /exceeds the available context size/i, suggestion: "Increase server context if supported." },
	{ pattern: /greater than the context length/i, suggestion: "Lower keep tokens / trim prompt." },
	{ pattern: /context window exceeds limit/i, suggestion: "Summarize earlier turns before retrying." },
	{ pattern: /context[_ ]length[_ ]exceeded/i, suggestion: "Prune context to fit model limits." },
	{ pattern: /too many tokens/i, suggestion: "Shorten request and retry." },
	{ pattern: /token limit exceeded/i, suggestion: "Trim input and reduce output token budget." },
];

export function isContextOverflow(message: AssistantMessage, contextWindow?: number): boolean {
	if (message.stopReason === "error" && message.errorMessage) {
		if (OVERFLOW_PATTERN_CONFIG.some((entry) => entry.pattern.test(message.errorMessage!))) {
			return true;
		}
		if (/^4(00|13|29)\s*(status code)?\s*\(no body\)/i.test(message.errorMessage)) {
			return true;
		}
	}

	if (contextWindow && message.stopReason === "stop") {
		const inputTokens = message.usage.input + message.usage.cacheRead;
		if (inputTokens > contextWindow) {
			return true;
		}
	}

	return false;
}

export function getOverflowPatterns(): RegExp[] {
	return OVERFLOW_PATTERN_CONFIG.map((entry) => entry.pattern);
}

export function getOverflowSuggestion(errorMessage: string | undefined): string | undefined {
	if (!errorMessage) return undefined;
	const match = OVERFLOW_PATTERN_CONFIG.find((entry) => entry.pattern.test(errorMessage));
	if (match) return match.suggestion;
	if (/^4(00|13|29)\s*(status code)?\s*\(no body\)/i.test(errorMessage)) {
		return "Provider returned a generic overflow-like status. Retry with shorter context.";
	}
	return undefined;
}
