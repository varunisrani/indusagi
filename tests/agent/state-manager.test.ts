import { describe, expect, it } from "vitest";
import { AgentStateManager } from "../../src/agent/state-manager.js";

const makeState = () => ({
	systemPrompt: "",
	model: { id: "m", provider: "p", api: "a" } as any,
	thinkingLevel: "off" as const,
	tools: [],
	messages: [],
	isStreaming: false,
	streamMessage: null,
	pendingToolCalls: new Set<string>(),
	error: undefined,
});

describe("agent/state-manager", () => {
	it("updates pending tool calls", () => {
		const m = new AgentStateManager(makeState());
		m.addPendingToolCall("1");
		expect(m.getState().pendingToolCalls.has("1")).toBe(true);
		m.removePendingToolCall("1");
		expect(m.getState().pendingToolCalls.has("1")).toBe(false);
	});
});
