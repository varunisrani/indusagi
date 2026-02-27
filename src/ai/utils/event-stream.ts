import type { AssistantMessage, AssistantMessageEvent, ToolCall } from "../types.js";

export interface EventStreamOptions {
	historyLimit?: number;
}

// Generic event stream class for async iteration
export class EventStream<T, R = T> implements AsyncIterable<T> {
	private queue: T[] = [];
	private waiting: ((value: IteratorResult<T>) => void)[] = [];
	private done = false;
	private finalResultPromise: Promise<R>;
	private resolveFinalResult!: (result: R) => void;
	private history: T[] = [];

	constructor(
		private isComplete: (event: T) => boolean,
		private extractResult: (event: T) => R,
		private options: EventStreamOptions = {},
	) {
		this.finalResultPromise = new Promise((resolve) => {
			this.resolveFinalResult = resolve;
		});
	}

	push(event: T): void {
		if (this.done) return;

		this.pushHistory(event);

		if (this.isComplete(event)) {
			this.done = true;
			this.resolveFinalResult(this.extractResult(event));
		}

		// Deliver to waiting consumer or queue it
		const waiter = this.waiting.shift();
		if (waiter) {
			waiter({ value: event, done: false });
		} else {
			this.queue.push(event);
		}
	}

	end(result?: R): void {
		this.done = true;
		if (result !== undefined) {
			this.resolveFinalResult(result);
		}
		// Notify all waiting consumers that we're done
		while (this.waiting.length > 0) {
			const waiter = this.waiting.shift()!;
			waiter({ value: undefined as never, done: true });
		}
	}

	async *[Symbol.asyncIterator](): AsyncIterator<T> {
		while (true) {
			if (this.queue.length > 0) {
				yield this.queue.shift()!;
			} else if (this.done) {
				return;
			} else {
				const result = await new Promise<IteratorResult<T>>((resolve) => this.waiting.push(resolve));
				if (result.done) return;
				yield result.value;
			}
		}
	}

	result(): Promise<R> {
		return this.finalResultPromise;
	}

	resultWithTimeout(timeoutMs: number): Promise<R> {
		return new Promise<R>((resolve, reject) => {
			const timer = setTimeout(() => reject(new Error(`Event stream timed out after ${timeoutMs}ms`)), timeoutMs);
			this.result()
				.then((value) => {
					clearTimeout(timer);
					resolve(value);
				})
				.catch((error) => {
					clearTimeout(timer);
					reject(error);
				});
		});
	}

	filter(predicate: (event: T) => boolean): AsyncIterable<T> {
		const self = this;
		return {
			async *[Symbol.asyncIterator]() {
				for await (const event of self) {
					if (predicate(event)) yield event;
				}
			},
		};
	}

	map<U>(mapper: (event: T) => U): AsyncIterable<U> {
		const self = this;
		return {
			async *[Symbol.asyncIterator]() {
				for await (const event of self) {
					yield mapper(event);
				}
			},
		};
	}

	getHistory(): readonly T[] {
		return this.history;
	}

	private pushHistory(event: T): void {
		this.history.push(event);
		const limit = this.options.historyLimit;
		if (limit && limit > 0 && this.history.length > limit) {
			this.history.splice(0, this.history.length - limit);
		}
	}
}

export class AssistantMessageEventStream extends EventStream<AssistantMessageEvent, AssistantMessage> {
	constructor(options?: EventStreamOptions) {
		super(
			(event) => event.type === "done" || event.type === "error",
			(event) => {
				if (event.type === "done") {
					return event.message;
				} else if (event.type === "error") {
					return event.error;
				}
				throw new Error("Unexpected event type for final result");
			},
			options,
		);
	}

	pushStart(partial: AssistantMessage): void {
		this.push({ type: "start", partial });
	}
	pushTextStart(contentIndex: number, partial: AssistantMessage): void {
		this.push({ type: "text_start", contentIndex, partial });
	}
	pushTextDelta(contentIndex: number, delta: string, partial: AssistantMessage): void {
		this.push({ type: "text_delta", contentIndex, delta, partial });
	}
	pushTextEnd(contentIndex: number, content: string, partial: AssistantMessage): void {
		this.push({ type: "text_end", contentIndex, content, partial });
	}
	pushThinkingStart(contentIndex: number, partial: AssistantMessage): void {
		this.push({ type: "thinking_start", contentIndex, partial });
	}
	pushThinkingDelta(contentIndex: number, delta: string, partial: AssistantMessage): void {
		this.push({ type: "thinking_delta", contentIndex, delta, partial });
	}
	pushThinkingEnd(contentIndex: number, content: string, partial: AssistantMessage): void {
		this.push({ type: "thinking_end", contentIndex, content, partial });
	}
	pushToolCallStart(contentIndex: number, partial: AssistantMessage): void {
		this.push({ type: "toolcall_start", contentIndex, partial });
	}
	pushToolCallDelta(contentIndex: number, delta: string, partial: AssistantMessage): void {
		this.push({ type: "toolcall_delta", contentIndex, delta, partial });
	}
	pushToolCallEnd(contentIndex: number, toolCall: ToolCall, partial: AssistantMessage): void {
		this.push({ type: "toolcall_end", contentIndex, toolCall, partial });
	}
	pushDone(reason: "stop" | "length" | "toolUse", message: AssistantMessage): void {
		this.push({ type: "done", reason, message });
	}
	pushError(reason: "aborted" | "error", error: AssistantMessage): void {
		this.push({ type: "error", reason, error });
	}
}

/** Factory function for AssistantMessageEventStream (for use in extensions) */
export function createAssistantMessageEventStream(options?: EventStreamOptions): AssistantMessageEventStream {
	return new AssistantMessageEventStream(options);
}
