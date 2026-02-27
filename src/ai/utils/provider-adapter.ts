import type {
	Api,
	AssistantMessage,
	Context,
	Model,
	StreamOptions,
	Tool,
} from "../types.js";
import type { AssistantMessageEventStream } from "./event-stream.js";
import type { StreamingStateManager } from "./streaming-state-manager.js";

/**
 * Generic adapter interface for streaming providers.
 * Encapsulates provider-specific client, request building, and stream processing.
 */
export interface ProviderAdapter<TOptions extends StreamOptions = StreamOptions> {
	/** API identifier (e.g., "anthropic-messages"). */
	readonly api: Api;

	/** Provider name (e.g., "anthropic"). */
	readonly provider: string;

	/** Model identifier. */
	readonly model: Model<Api>;

	/** Optional provider-specific options. */
	readonly options?: TOptions;

	/** Context (system prompt, messages, tools). */
	readonly context: Context;

	/** Stream to push events to. */
	readonly stream: AssistantMessageEventStream;

	/** Optional abort signal. */
	readonly signal?: AbortSignal;

	/** Streaming state manager (tracks output, usage, stop reason). */
	state: StreamingStateManager;

	/** Initialize the adapter (e.g., create client). */
	initialize(): Promise<void> | void;

	/** Build provider-specific request parameters. */
	buildRequest(): unknown;

	/** Execute the request and stream events. */
	executeStream(): Promise<void>;

	/** Cleanup resources after streaming completes. */
	cleanup(): Promise<void> | void;
}

/**
 * Base adapter with shared lifecycle and helper methods.
 */
export abstract class BaseProviderAdapter<TOptions extends StreamOptions = StreamOptions> implements ProviderAdapter<TOptions> {
	readonly api: Api;
	readonly provider: string;

	constructor(
		public readonly model: Model<Api>,
		public readonly context: Context,
		public readonly stream: AssistantMessageEventStream,
		public readonly options?: TOptions,
		public readonly signal?: AbortSignal,
	) {
		this.api = model.api;
		this.provider = model.provider;
	}

	/** To be set by subclasses during initialization. */
	state!: StreamingStateManager;

	abstract initialize(): Promise<void> | void;
	abstract buildRequest(): unknown;
	abstract executeStream(): Promise<void>;
	cleanup(): Promise<void> | void {
		// No-op by default.
	}

	/** Check if aborted. */
	protected isAborted(): boolean {
		return this.signal?.aborted ?? false;
	}

	/** Emit error if aborted. */
	protected throwIfAborted(): void {
		if (this.isAborted()) {
			throw new Error("Operation aborted");
		}
	}
}
