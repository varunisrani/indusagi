import type { Api, AssistantMessage, Context, Model, StreamOptions } from "../types.js";
import type { AssistantMessageEventStream } from "./event-stream.js";
import type { StreamingStateManager } from "./streaming-state-manager.js";

/**
 * Shared type definitions for stream handler implementations.
 */

/**
 * Context provided to stream handlers during execution.
 */
export interface StreamHandlerExecutionContext {
	model: Model<Api>;
	context: Context;
	stream: AssistantMessageEventStream;
	options?: StreamOptions;
	signal?: AbortSignal;
	state: StreamingStateManager;
}

/**
 * Generic provider request shape (to be extended by each provider).
 */
export interface ProviderRequest {
	[ key: string ]: unknown;
}

/**
 * Generic provider response shape.
 */
export interface ProviderResponse {
	[ key: string ]: unknown;
}

/**
 * Abstract handler base with shared context typing.
 */
export abstract class TypedStreamHandler<TOptions extends StreamOptions = StreamOptions> {
	constructor(
		protected readonly model: Model<Api>,
		protected readonly context: Context,
		protected readonly stream: AssistantMessageEventStream,
		protected readonly options?: TOptions,
		protected readonly signal?: AbortSignal,
	) {}

	protected createStateManager(initialOutput: AssistantMessage): StreamingStateManager {
		// Lazy import to avoid circular reference
		const { StreamingStateManager } = require("./streaming-state-manager.js");
		return new StreamingStateManager(initialOutput);
	}

	abstract execute(): AssistantMessageEventStream;
}
