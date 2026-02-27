import type { AssistantMessage, TextContent, ThinkingContent, ToolCall } from "../types.js";
import type { AssistantMessageEventStream } from "./event-stream.js";

export type StreamBlock = TextContent | ThinkingContent | ToolCall;

/** Utility for locating provider blocks by provider-native `index` values. */
export class BlockTracker<TBlock extends StreamBlock = StreamBlock> {
	private readonly blocks: Array<TBlock & { index?: number }>;

	constructor(output: AssistantMessage) {
		this.blocks = output.content as Array<TBlock & { index?: number }>;
	}

	findByIndex(index: number): (TBlock & { index?: number }) | undefined {
		return this.blocks.find((b) => b.index === index);
	}

	findPositionByIndex(index: number): number {
		return this.blocks.findIndex((b) => b.index === index);
	}
}

export class StreamEventHelper {
	constructor(
		private readonly stream: AssistantMessageEventStream,
		private readonly output: AssistantMessage,
	) {}

	start(): void {
		this.stream.pushStart(this.output);
	}

	textStart(contentIndex: number): void {
		this.stream.pushTextStart(contentIndex, this.output);
	}
	textDelta(contentIndex: number, delta: string): void {
		this.stream.pushTextDelta(contentIndex, delta, this.output);
	}
	textEnd(contentIndex: number, content: string): void {
		this.stream.pushTextEnd(contentIndex, content, this.output);
	}

	thinkingStart(contentIndex: number): void {
		this.stream.pushThinkingStart(contentIndex, this.output);
	}
	thinkingDelta(contentIndex: number, delta: string): void {
		this.stream.pushThinkingDelta(contentIndex, delta, this.output);
	}
	thinkingEnd(contentIndex: number, content: string): void {
		this.stream.pushThinkingEnd(contentIndex, content, this.output);
	}

	toolCallStart(contentIndex: number): void {
		this.stream.pushToolCallStart(contentIndex, this.output);
	}
	toolCallDelta(contentIndex: number, delta: string): void {
		this.stream.pushToolCallDelta(contentIndex, delta, this.output);
	}
	toolCallEnd(contentIndex: number, toolCall: ToolCall): void {
		this.stream.pushToolCallEnd(contentIndex, toolCall, this.output);
	}
}
