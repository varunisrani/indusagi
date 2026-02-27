import type { Api, AssistantMessage, Message, Model, ToolCall, ToolResultMessage } from "../types.js";
import { validateMessage } from "../types.js";

export interface MessageTransformContext<TApi extends Api> {
	model: Model<TApi>;
	normalizeToolCallId?: (id: string, model: Model<TApi>, source: AssistantMessage) => string;
	debug?: (stage: string, details?: unknown) => void;
}

export interface MessageTransformation<TApi extends Api> {
	name: string;
	apply(messages: Message[], context: MessageTransformContext<TApi>): Message[];
}

class NormalizeAssistantContentTransformation<TApi extends Api> implements MessageTransformation<TApi> {
	name = "normalize-assistant-content";

	apply(messages: Message[], context: MessageTransformContext<TApi>): Message[] {
		const { model, normalizeToolCallId } = context;
		const toolCallIdMap = new Map<string, string>();

		return messages.map((msg) => {
			if (msg.role === "user") return msg;
			if (msg.role === "toolResult") {
				const normalizedId = toolCallIdMap.get(msg.toolCallId);
				if (normalizedId && normalizedId !== msg.toolCallId) {
					return { ...msg, toolCallId: normalizedId };
				}
				return msg;
			}

			const assistantMsg = msg as AssistantMessage;
			const isSameModel =
				assistantMsg.provider === model.provider &&
				assistantMsg.api === model.api &&
				assistantMsg.model === model.id;

			const transformedContent = assistantMsg.content.flatMap((block) => {
				if (block.type === "thinking") {
					if (isSameModel && block.thinkingSignature) return block;
					if (!block.thinking || block.thinking.trim() === "") return [];
					if (isSameModel) return block;
					return { type: "text" as const, text: block.thinking };
				}

				if (block.type === "text") {
					if (isSameModel) return block;
					return { type: "text" as const, text: block.text };
				}

				if (block.type === "toolCall") {
					const toolCall = block as ToolCall;
					let normalizedToolCall: ToolCall = toolCall;

					if (!isSameModel && toolCall.thoughtSignature) {
						normalizedToolCall = { ...toolCall };
						delete (normalizedToolCall as { thoughtSignature?: string }).thoughtSignature;
					}

					if (!isSameModel && normalizeToolCallId) {
						const normalizedId = normalizeToolCallId(toolCall.id, model, assistantMsg);
						if (normalizedId !== toolCall.id) {
							toolCallIdMap.set(toolCall.id, normalizedId);
							normalizedToolCall = { ...normalizedToolCall, id: normalizedId };
						}
					}

					return normalizedToolCall;
				}

				return block;
			});

			return { ...assistantMsg, content: transformedContent };
		});
	}
}

class InsertSyntheticToolResultsTransformation<TApi extends Api> implements MessageTransformation<TApi> {
	name = "insert-synthetic-tool-results";

	apply(messages: Message[]): Message[] {
		const result: Message[] = [];
		let pendingToolCalls: ToolCall[] = [];
		let existingToolResultIds = new Set<string>();

		for (const msg of messages) {
			if (msg.role === "assistant") {
				if (pendingToolCalls.length > 0) {
					for (const tc of pendingToolCalls) {
						if (!existingToolResultIds.has(tc.id)) {
							result.push(this.syntheticToolResult(tc));
						}
					}
					pendingToolCalls = [];
					existingToolResultIds = new Set();
				}

				const assistantMsg = msg as AssistantMessage;
				if (assistantMsg.stopReason === "error" || assistantMsg.stopReason === "aborted") {
					continue;
				}

				const toolCalls = assistantMsg.content.filter((b) => b.type === "toolCall") as ToolCall[];
				if (toolCalls.length > 0) {
					pendingToolCalls = toolCalls;
					existingToolResultIds = new Set();
				}
				result.push(msg);
				continue;
			}

			if (msg.role === "toolResult") {
				existingToolResultIds.add(msg.toolCallId);
				result.push(msg);
				continue;
			}

			if (msg.role === "user" && pendingToolCalls.length > 0) {
				for (const tc of pendingToolCalls) {
					if (!existingToolResultIds.has(tc.id)) {
						result.push(this.syntheticToolResult(tc));
					}
				}
				pendingToolCalls = [];
				existingToolResultIds = new Set();
			}

			result.push(msg);
		}

		return result;
	}

	private syntheticToolResult(toolCall: ToolCall): ToolResultMessage {
		return {
			role: "toolResult",
			toolCallId: toolCall.id,
			toolName: toolCall.name,
			content: [{ type: "text", text: "No result provided" }],
			isError: true,
			timestamp: Date.now(),
		};
	}
}

export class MessageTransformationPipeline<TApi extends Api> {
	private transformations: MessageTransformation<TApi>[] = [];

	addTransformation(transformation: MessageTransformation<TApi>): this {
		this.transformations.push(transformation);
		return this;
	}

	transform(messages: Message[], context: MessageTransformContext<TApi>): Message[] {
		for (const message of messages) validateMessage(message);
		let current = [...messages];
		for (const transformation of this.transformations) {
			context.debug?.(transformation.name, { before: current.length });
			current = transformation.apply(current, context);
			context.debug?.(transformation.name, { after: current.length });
			for (const message of current) validateMessage(message);
		}
		return current;
	}
}

/**
 * Normalize tool call ID for cross-provider compatibility.
 * OpenAI Responses API generates IDs that are 450+ chars with special characters like `|`.
 * Anthropic APIs require IDs matching ^[a-zA-Z0-9_-]+$ (max 64 chars).
 */
export function transformMessages<TApi extends Api>(
	messages: Message[],
	model: Model<TApi>,
	normalizeToolCallId?: (id: string, model: Model<TApi>, source: AssistantMessage) => string,
): Message[] {
	const pipeline = new MessageTransformationPipeline<TApi>()
		.addTransformation(new NormalizeAssistantContentTransformation<TApi>())
		.addTransformation(new InsertSyntheticToolResultsTransformation<TApi>());

	return pipeline.transform(messages, { model, normalizeToolCallId });
}
