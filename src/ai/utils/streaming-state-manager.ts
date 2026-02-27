import type { AssistantMessage, StopReason, Usage } from "../types.js";

/**
 * Centralized streaming state manager for provider handlers.
 *
 * Tracks output, usage, stop reason, and stream lifecycle in a single
 * place to avoid duplicated state management across provider implementations.
 */
export class StreamingStateManager {
	/** The mutable assistant output message being built. */
	public readonly output: AssistantMessage;

	private _stopReason: StopReason = "stop";
	private _isComplete = false;

	/**
	 * Create a new streaming state manager.
	 *
	 * @param initialOutput - The initial assistant output message.
	 */
	constructor(
		initialOutput: AssistantMessage,
	) {
		this.output = initialOutput;
	}

	/**
	 * Update usage fields from a partial usage update.
	 *
	 * @param update - Partial usage object with fields to update.
	 */
	setUsage(update: Partial<Usage>): void {
		Object.assign(this.output.usage, update);
	}

	/**
	 * Update the stop reason.
	 *
	 * @param reason - New stop reason.
	 */
	setStopReason(reason: StopReason): void {
		this._stopReason = reason;
		this.output.stopReason = reason;
	}

	/**
	 * Get the current stop reason.
	 */
	get stopReason(): StopReason {
		return this._stopReason;
	}

	/**
	 * Mark streaming as complete.
	 */
	complete(): void {
		this._isComplete = true;
	}

	/**
	 * Check if streaming is marked complete.
	 */
	get isComplete(): boolean {
		return this._isComplete;
	}

	/**
	 * Mark streaming as errored.
	 *
	 * @param errorMessage - Human-readable error message.
	 */
	error(errorMessage: string): void {
		this._isComplete = true;
		this._stopReason = "error";
		this.output.stopReason = "error";
		this.output.errorMessage = errorMessage;
	}
}
