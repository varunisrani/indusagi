import type { AgentMessage, AgentState, ThinkingLevel, AgentTool } from "./types.js";
import type { Model } from "../ai/index.js";

export class AgentStateManager {
	constructor(private state: AgentState) {}

	getState(): AgentState {
		return this.state;
	}

	setSystemPrompt(v: string): void {
		this.state.systemPrompt = v;
	}

	setModel(m: Model<any>): void {
		this.state.model = m;
	}

	setThinkingLevel(level: ThinkingLevel): void {
		this.state.thinkingLevel = level;
	}

	setTools(tools: AgentTool<any>[]): void {
		this.state.tools = tools;
	}

	replaceMessages(messages: AgentMessage[]): void {
		this.state.messages = messages.slice();
	}

	appendMessage(message: AgentMessage): void {
		this.state.messages = [...this.state.messages, message];
	}

	clearMessages(): void {
		this.state.messages = [];
	}

	setStreaming(streaming: boolean): void {
		this.state.isStreaming = streaming;
	}

	setStreamMessage(message: AgentMessage | null): void {
		this.state.streamMessage = message;
	}

	setError(error: string | undefined): void {
		this.state.error = error;
	}

	addPendingToolCall(toolCallId: string): void {
		const pending = new Set(this.state.pendingToolCalls);
		pending.add(toolCallId);
		this.state.pendingToolCalls = pending;
	}

	removePendingToolCall(toolCallId: string): void {
		const pending = new Set(this.state.pendingToolCalls);
		pending.delete(toolCallId);
		this.state.pendingToolCalls = pending;
	}

	clearPendingToolCalls(): void {
		this.state.pendingToolCalls = new Set<string>();
	}

	reset(): void {
		this.clearMessages();
		this.setStreaming(false);
		this.setStreamMessage(null);
		this.clearPendingToolCalls();
		this.setError(undefined);
	}
}
