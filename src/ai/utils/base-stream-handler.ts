import type { AssistantMessage, StopReason } from "../types.js";
import type { AssistantMessageEventStream } from "./event-stream.js";

export interface StreamHandlerContext {
	output: AssistantMessage;
	stream: AssistantMessageEventStream;
	signal?: AbortSignal;
}

export abstract class BaseStreamHandler<TContext extends StreamHandlerContext = StreamHandlerContext> {
	constructor(protected readonly context?: TContext) {}

	protected abstract processStream(): Promise<void>;

	async run(): Promise<void> {
		await this.processStream();
	}

	protected done(reason: Extract<StopReason, "stop" | "length" | "toolUse">): void {
		if (!this.context) return;
		this.context.output.stopReason = reason;
		this.context.stream.pushDone(reason, this.context.output);
		this.context.stream.end();
	}

	protected fail(error: unknown): void {
		if (!this.context) return;
		this.context.output.stopReason = this.context.signal?.aborted ? "aborted" : "error";
		this.context.output.errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
		this.context.stream.pushError(this.context.output.stopReason, this.context.output);
		this.context.stream.end();
	}
}
