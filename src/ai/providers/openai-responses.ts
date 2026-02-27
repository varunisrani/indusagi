import OpenAI from "openai";
import type { ResponseCreateParamsStreaming } from "openai/resources/responses/responses.js";
import { getEnvApiKey } from "../env-api-keys.js";
import { supportsXhigh } from "../models.js";
import type {
	Api,
	AssistantMessage,
	Context,
	Model,
	SimpleStreamOptions,
	StreamFunction,
	StreamOptions,
	Usage,
} from "../types.js";
import { AssistantMessageEventStream } from "../utils/event-stream.js";
import { BaseStreamHandler } from "../utils/base-stream-handler.js";
import { createAssistantMessageOutput } from "../utils/output-factory.js";
import { StreamEventHelper } from "../utils/stream-event-helper.js";
import {
	convertResponsesMessages,
	convertResponsesTools,
	executeOpenAIRequest,
	processResponsesStream,
} from "./openai-responses-shared.js";
import { buildBaseOptions, mapThinkingLevel } from "./simple-options.js";

const OPENAI_TOOL_CALL_PROVIDERS = new Set(["openai", "openai-codex", "opencode"]);

// OpenAI Responses-specific options
export interface OpenAIResponsesOptions extends StreamOptions {
	reasoningEffort?: "minimal" | "low" | "medium" | "high" | "xhigh";
	reasoningSummary?: "auto" | "detailed" | "concise" | null;
	serviceTier?: ResponseCreateParamsStreaming["service_tier"];
}

/**
 * OpenAI Responses API stream handler.
 *
 * Handles streaming responses from OpenAI's Responses API and emits
 * standardized assistant events.
 */
class OpenAIResponsesStreamHandler extends BaseStreamHandler {
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
 * Generate function for OpenAI Responses API
 */
export const streamOpenAIResponses: StreamFunction<"openai-responses", OpenAIResponsesOptions> = (
	model: Model<"openai-responses">,
	context: Context,
	options?: OpenAIResponsesOptions,
): AssistantMessageEventStream => {
	const stream = new AssistantMessageEventStream();
	const output: AssistantMessage = createAssistantMessageOutput(model);
	const events = new StreamEventHelper(stream, output);
	const handler = new OpenAIResponsesStreamHandler(async () => {
		try {
			const apiKey = options?.apiKey || getEnvApiKey(model.provider) || "";
			const client = createClient(model, context, apiKey, options?.headers);
			const params = buildParams(model, context, options);
			options?.onPayload?.(params);
			const openaiStream = await executeOpenAIRequest(
				params,
				() => client.responses.create(params, options?.signal ? { signal: options.signal } : undefined),
				{ retryPolicy: { maxAttempts: options?.signal ? 1 : 3, baseDelayMs: 250 } },
			);
			events.start();
			await processResponsesStream(openaiStream, output, stream, model, {
				serviceTier: options?.serviceTier,
				applyServiceTierPricing,
			});
			if (options?.signal?.aborted) throw new Error("Request was aborted");
			if (output.stopReason === "aborted" || output.stopReason === "error") throw new Error("An unknown error occurred");
			stream.pushDone(output.stopReason, output);
			stream.end();
		} catch (error) {
			for (const block of output.content) delete (block as { index?: number }).index;
			output.stopReason = options?.signal?.aborted ? "aborted" : "error";
			output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
			stream.pushError(output.stopReason, output);
			stream.end();
		}
	});
	void handler.run();
	return stream;
};

export const streamSimpleOpenAIResponses: StreamFunction<"openai-responses", SimpleStreamOptions> = (
	model: Model<"openai-responses">,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream => {
	const apiKey = options?.apiKey || getEnvApiKey(model.provider);
	if (!apiKey) {
		throw new Error(`No API key for provider: ${model.provider}`);
	}

	const base = buildBaseOptions(model, options, apiKey);
	const reasoningEffort = mapThinkingLevel(options?.reasoning, supportsXhigh(model) ? "supports-xhigh" : "clamp-xhigh");

	return streamOpenAIResponses(model, context, {
		...base,
		reasoningEffort,
	} satisfies OpenAIResponsesOptions);
};

function createClient(
	model: Model<"openai-responses">,
	context: Context,
	apiKey?: string,
	optionsHeaders?: Record<string, string>,
) {
	if (!apiKey) {
		if (!process.env.OPENAI_API_KEY) {
			throw new Error(
				"OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it as an argument.",
			);
		}
		apiKey = process.env.OPENAI_API_KEY;
	}

	const headers = { ...model.headers };
	if (model.provider === "github-copilot") {
		// Copilot expects X-Initiator to indicate whether the request is user-initiated
		// or agent-initiated (e.g. follow-up after assistant/tool messages). If there is
		// no prior message, default to user-initiated.
		const messages = context.messages || [];
		const lastMessage = messages[messages.length - 1];
		const isAgentCall = lastMessage ? lastMessage.role !== "user" : false;
		headers["X-Initiator"] = isAgentCall ? "agent" : "user";
		headers["Openai-Intent"] = "conversation-edits";

		// Copilot requires this header when sending images
		const hasImages = messages.some((msg) => {
			if (msg.role === "user" && Array.isArray(msg.content)) {
				return msg.content.some((c) => c.type === "image");
			}
			if (msg.role === "toolResult" && Array.isArray(msg.content)) {
				return msg.content.some((c) => c.type === "image");
			}
			return false;
		});
		if (hasImages) {
			headers["Copilot-Vision-Request"] = "true";
		}
	}

	// Merge options headers last so they can override defaults
	if (optionsHeaders) {
		Object.assign(headers, optionsHeaders);
	}

	return new OpenAI({
		apiKey,
		baseURL: model.baseUrl,
		dangerouslyAllowBrowser: true,
		defaultHeaders: headers,
	});
}

function buildParams(model: Model<"openai-responses">, context: Context, options?: OpenAIResponsesOptions) {
	const messages = convertResponsesMessages(model, context, OPENAI_TOOL_CALL_PROVIDERS);

	const params: ResponseCreateParamsStreaming = {
		model: model.id,
		input: messages,
		stream: true,
		prompt_cache_key: options?.sessionId,
	};

	if (options?.maxTokens) {
		params.max_output_tokens = options?.maxTokens;
	}

	if (options?.temperature !== undefined) {
		params.temperature = options?.temperature;
	}

	if (options?.serviceTier !== undefined) {
		params.service_tier = options.serviceTier;
	}

	if (context.tools) {
		params.tools = convertResponsesTools(context.tools);
	}

	if (model.reasoning) {
		if (options?.reasoningEffort || options?.reasoningSummary) {
			params.reasoning = {
				effort: options?.reasoningEffort || "medium",
				summary: options?.reasoningSummary || "auto",
			};
			params.include = ["reasoning.encrypted_content"];
		} else {
			if (model.name.startsWith("gpt-5")) {
				// Jesus Christ, see https://community.openai.com/t/need-reasoning-false-option-for-gpt-5/1351588/7
				messages.push({
					role: "developer",
					content: [
						{
							type: "input_text",
							text: "# Juice: 0 !important",
						},
					],
				});
			}
		}
	}

	return params;
}

function getServiceTierCostMultiplier(serviceTier: ResponseCreateParamsStreaming["service_tier"] | undefined): number {
	switch (serviceTier) {
		case "flex":
			return 0.5;
		case "priority":
			return 2;
		default:
			return 1;
	}
}

function applyServiceTierPricing(usage: Usage, serviceTier: ResponseCreateParamsStreaming["service_tier"] | undefined) {
	const multiplier = getServiceTierCostMultiplier(serviceTier);
	if (multiplier === 1) return;

	usage.cost.input *= multiplier;
	usage.cost.output *= multiplier;
	usage.cost.cacheRead *= multiplier;
	usage.cost.cacheWrite *= multiplier;
	usage.cost.total = usage.cost.input + usage.cost.output + usage.cost.cacheRead + usage.cost.cacheWrite;
}
