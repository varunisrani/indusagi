import type { Api, Model, SimpleStreamOptions, StreamOptions, ThinkingBudgets, ThinkingLevel } from "../types.js";

export interface ProviderLifecycleHooks<TRequest = unknown, TResponse = unknown> {
	onBeforeRequest?: (request: TRequest) => void | Promise<void>;
	onAfterResponse?: (response: TResponse) => void | Promise<void>;
	onError?: (error: unknown) => void | Promise<void>;
}

export interface RetryPolicy {
	maxAttempts: number;
	baseDelayMs: number;
	maxDelayMs?: number;
	shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export class SimpleOptionsProviderError extends Error {
	constructor(
		message: string,
		public readonly code: "rate_limit" | "timeout" | "network" | "validation" | "auth" | "unknown" = "unknown",
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "SimpleOptionsProviderError";
	}
}

export function normalizeProviderError(error: unknown): SimpleOptionsProviderError {
	if (error instanceof SimpleOptionsProviderError) return error;
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		if (message.includes("rate") && message.includes("limit")) {
			return new SimpleOptionsProviderError(error.message, "rate_limit", error);
		}
		if (message.includes("timeout") || message.includes("timed out")) {
			return new SimpleOptionsProviderError(error.message, "timeout", error);
		}
		if (message.includes("network") || message.includes("fetch")) {
			return new SimpleOptionsProviderError(error.message, "network", error);
		}
		if (message.includes("auth") || message.includes("unauthorized") || message.includes("forbidden")) {
			return new SimpleOptionsProviderError(error.message, "auth", error);
		}
		if (message.includes("invalid") || message.includes("schema") || message.includes("validation")) {
			return new SimpleOptionsProviderError(error.message, "validation", error);
		}
		return new SimpleOptionsProviderError(error.message, "unknown", error);
	}
	return new SimpleOptionsProviderError("Unknown provider error", "unknown", error);
}

export async function executeWithRetry<T>(operation: () => Promise<T>, policy: RetryPolicy): Promise<T> {
	let attempt = 0;
	let lastError: unknown;

	while (attempt < policy.maxAttempts) {
		attempt++;
		try {
			return await operation();
		} catch (error) {
			lastError = error;
			const normalized = normalizeProviderError(error);
			const defaultRetryable = normalized.code === "rate_limit" || normalized.code === "timeout" || normalized.code === "network";
			const retryable = policy.shouldRetry ? policy.shouldRetry(error, attempt) : defaultRetryable;
			if (!retryable || attempt >= policy.maxAttempts) {
				throw normalized;
			}
			const maxDelay = policy.maxDelayMs ?? Number.MAX_SAFE_INTEGER;
			const backoff = Math.min(policy.baseDelayMs * 2 ** (attempt - 1), maxDelay);
			await new Promise((resolve) => setTimeout(resolve, backoff));
		}
	}

	throw normalizeProviderError(lastError);
}

export function buildBaseOptions(model: Model<Api>, options?: SimpleStreamOptions, apiKey?: string): StreamOptions {
	return {
		temperature: options?.temperature,
		maxTokens: options?.maxTokens || Math.min(model.maxTokens, 32000),
		signal: options?.signal,
		apiKey: apiKey || options?.apiKey,
		sessionId: options?.sessionId,
		headers: options?.headers,
		onPayload: options?.onPayload,
	};
}

export function clampReasoning(effort: ThinkingLevel | undefined): Exclude<ThinkingLevel, "xhigh"> | undefined {
	return effort === "xhigh" ? "high" : effort;
}

export function mapThinkingLevel(
	level: ThinkingLevel | undefined,
	provider: "supports-xhigh" | "clamp-xhigh" = "clamp-xhigh",
): ThinkingLevel | Exclude<ThinkingLevel, "xhigh"> | undefined {
	if (!level) return undefined;
	if (provider === "supports-xhigh") return level;
	return clampReasoning(level);
}

export function adjustMaxTokensForThinking(
	baseMaxTokens: number,
	modelMaxTokens: number,
	reasoningLevel: ThinkingLevel,
	customBudgets?: ThinkingBudgets,
): { maxTokens: number; thinkingBudget: number } {
	const defaultBudgets: ThinkingBudgets = {
		minimal: 1024,
		low: 2048,
		medium: 8192,
		high: 16384,
	};
	const budgets = { ...defaultBudgets, ...customBudgets };

	const minOutputTokens = 1024;
	const level = clampReasoning(reasoningLevel)!;
	let thinkingBudget = budgets[level]!;
	const maxTokens = Math.min(baseMaxTokens + thinkingBudget, modelMaxTokens);

	if (maxTokens <= thinkingBudget) {
		thinkingBudget = Math.max(0, maxTokens - minOutputTokens);
	}

	return { maxTokens, thinkingBudget };
}
