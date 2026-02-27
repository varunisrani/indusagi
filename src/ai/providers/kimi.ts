/**
 * Kimi (Moonshot AI) provider
 *
 * Supports two Kimi API endpoints:
 * 1. Standard Kimi API: https://api.kimi.moonshot.cn/v1 (kimi provider)
 * 2. Kimi Code API: https://api.kimi.moonshot.cn/v1/code (kimi-coding provider)
 *
 * Kimi Code is a subscription-based service with dedicated endpoint for coding tasks.
 */

import { getEnvApiKey } from "../env-api-keys.js";
import type {
	Api,
	AssistantMessage,
	Context,
	Model,
	SimpleStreamOptions,
	StreamFunction,
	StreamOptions,
} from "../types.js";
import { BaseStreamHandler } from "../utils/base-stream-handler.js";
import { AssistantMessageEventStream } from "../utils/event-stream.js";
import { createAssistantMessageOutput } from "../utils/output-factory.js";
import { StreamEventHelper } from "../utils/stream-event-helper.js";
import { buildBaseOptions, executeWithRetry } from "./simple-options.js";
import { convertResponsesMessages, convertResponsesTools } from "./openai-responses-shared.js";

// Kimi API endpoints
const KIMI_API_BASE = "https://api.kimi.moonshot.cn/v1";
const KIMI_CODING_API_BASE = "https://api.kimi.moonshot.cn/v1";

// Default models
const DEFAULT_KIMI_MODEL = "moonshot-v1-128k";
const DEFAULT_KIMI_CODING_MODEL = "kimi-code-latest";

export interface KimiOptions extends StreamOptions {
	reasoningLevel?: "none" | "low" | "medium" | "high";
}

/**
 * Kimi (Moonshot AI) stream handler.
 *
 * Handles streaming responses from Kimi's API and emits
 * standardized assistant events.
 */
class KimiStreamHandler extends BaseStreamHandler {
	constructor(private readonly executeFn: () => Promise<void>) {
		super();
	}

	/**
	 * Execute the stream by invoking the provided async function.
	 */
	protected async processStream(): Promise<void> {
		await this.executeFn();
	}
}

/**
 * Stream function for Kimi API (OpenAI-compatible)
 */
export const streamKimi: StreamFunction<"kimi-openai-compatible", KimiOptions> = (
	model: Model<"kimi-openai-compatible">,
	context: Context,
	options?: KimiOptions,
): AssistantMessageEventStream => {
	const stream = new AssistantMessageEventStream();
	const output: AssistantMessage = createAssistantMessageOutput(model);
	const events = new StreamEventHelper(stream, output);
	const handler = new KimiStreamHandler(async () => {
		try {
			const apiKey = options?.apiKey || getEnvApiKey(model.provider) || "";
			if (!apiKey) {
				throw new Error(`No API key for provider: ${model.provider}`);
			}

			const baseUrl = model.baseUrl || getKimiBaseUrl(model.provider);
			const headers = buildHeaders(apiKey, model, options?.headers);

			// Convert messages to Kimi format (OpenAI-compatible)
			const messages = convertResponsesMessages(model, context, new Set(["kimi", "kimi-coding"]));
			const body: Record<string, unknown> = {
				model: model.id,
				messages,
				stream: true,
				temperature: options?.temperature ?? 0.5,
			};

			if (options?.maxTokens) {
				body.max_tokens = options.maxTokens;
			}

			if (context.tools && context.tools.length > 0) {
				body.tools = convertResponsesTools(context.tools);
			}

			options?.onPayload?.(body);

			const response = await executeWithRetry(
				() =>
					fetch(`${baseUrl}/chat/completions`, {
						method: "POST",
						headers,
						body: JSON.stringify(body),
						signal: options?.signal,
					}),
				{
					maxAttempts: options?.signal ? 1 : 3,
					baseDelayMs: 250,
				},
			);

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Kimi API error: ${response.status} ${errorText}`);
			}

			events.start();

			if (!response.body) {
				throw new Error("No response body");
			}

			// Process server-sent events
			await processKimiStream(response.body, output, stream);

			if (options?.signal?.aborted) {
				throw new Error("Request was aborted");
			}

			if (output.stopReason === "aborted" || output.stopReason === "error") {
				throw new Error(output.errorMessage || "An unknown error occurred");
			}

			stream.pushDone(output.stopReason, output);
			stream.end();
		} catch (error) {
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
			stream.pushError(output.stopReason, output);
			stream.end();
		}
	});
	void handler.run();
	return stream;
};

/**
 * Simple stream function for Kimi API
 */
export const streamSimpleKimi: StreamFunction<"kimi-openai-compatible", SimpleStreamOptions> = (
	model: Model<"kimi-openai-compatible">,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream => {
	const apiKey = options?.apiKey || getEnvApiKey(model.provider);
	if (!apiKey) {
		throw new Error(`No API key for provider: ${model.provider}`);
	}

	const base = buildBaseOptions(model, options, apiKey);
	return streamKimi(model, context, {
		...base,
		reasoningLevel: "low",
	} satisfies KimiOptions);
};

/**
 * Get base URL for Kimi provider
 */
function getKimiBaseUrl(provider: string): string {
	if (provider === "kimi-coding") {
		return KIMI_CODING_API_BASE;
	}
	return KIMI_API_BASE;
}

/**
 * Build headers for Kimi API request
 */
function buildHeaders(
	apiKey: string,
	model: Model<"kimi-openai-compatible">,
	optionsHeaders?: Record<string, string>,
): Record<string, string> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Authorization: `Bearer ${apiKey}`,
		"User-Agent": "indusagi/1.0",
	};

	// Merge model headers
	if (model.headers) {
		Object.assign(headers, model.headers);
	}

	// Merge options headers last so they can override defaults
	if (optionsHeaders) {
		Object.assign(headers, optionsHeaders);
	}

	return headers;
}

/**
 * Process Kimi streaming response (server-sent events)
 */
async function processKimiStream(
	body: ReadableStream<Uint8Array>,
	output: AssistantMessage,
	stream: AssistantMessageEventStream,
): Promise<void> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = "";

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");

			// Keep the last incomplete line in buffer
			buffer = lines[lines.length - 1];

			for (let i = 0; i < lines.length - 1; i++) {
				const line = lines[i].trim();
				if (!line) continue;

				if (line.startsWith("data: ")) {
					const data = line.slice(6);
					if (data === "[DONE]") {
						break;
					}

					try {
						const json = JSON.parse(data) as KimiStreamEvent;
						processKimiChunk(json, output, stream);
					} catch (_error) {
						// Ignore JSON parse errors
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}

	// Process any remaining buffer
	if (buffer.trim().startsWith("data: ")) {
		const data = buffer.trim().slice(6);
		if (data !== "[DONE]") {
			try {
				const json = JSON.parse(data) as KimiStreamEvent;
				processKimiChunk(json, output, stream);
			} catch (_error) {
				// Ignore JSON parse errors
			}
		}
	}
}

interface KimiStreamEvent {
	choices?: Array<{
		index: number;
		delta?: {
			role?: string;
			content?: string;
		};
		finish_reason?: string | null;
	}>;
	usage?: {
		prompt_tokens?: number;
		completion_tokens?: number;
		total_tokens?: number;
	};
}

/**
 * Process a single chunk from Kimi stream
 */
function processKimiChunk(
	event: KimiStreamEvent,
	output: AssistantMessage,
	stream: AssistantMessageEventStream,
): void {
	if (!event.choices || event.choices.length === 0) {
		return;
	}

	const choice = event.choices[0];
	if (!choice.delta || !choice.delta.content) {
		return;
	}

	const content = choice.delta.content;
	const lastBlock = output.content[output.content.length - 1];
	let contentIndex = output.content.length - 1;

	if (lastBlock && lastBlock.type === "text") {
		(lastBlock as { text?: string }).text = ((lastBlock as { text?: string }).text || "") + content;
	} else {
		output.content.push({
			type: "text",
			text: content,
		});
		contentIndex = output.content.length - 1;
	}

	stream.push({ type: "text_delta", contentIndex, delta: content, partial: output });

	// Update finish reason
	if (choice.finish_reason === "stop") {
		output.stopReason = "stop";
	} else if (choice.finish_reason === "length") {
		output.stopReason = "length";
	}

	// Update usage if provided
	if (event.usage) {
		output.usage.input = event.usage.prompt_tokens || 0;
		output.usage.output = event.usage.completion_tokens || 0;
		output.usage.totalTokens = event.usage.total_tokens || 0;
		// Calculate costs (these are example rates, update as needed)
		output.usage.cost.input = (event.usage.prompt_tokens || 0) * 0.000001; // Example: $1 per 1M tokens
		output.usage.cost.output = (event.usage.completion_tokens || 0) * 0.000002; // Example: $2 per 1M tokens
		output.usage.cost.total =
			output.usage.cost.input + output.usage.cost.output + output.usage.cost.cacheRead + output.usage.cost.cacheWrite;
	}
}
