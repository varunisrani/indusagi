import { describe, expect, it } from "vitest";
import { isToolCall, isThinking, isUserMessage, validateMessage } from "../../src/agent/types.js";

describe("agent/types", () => {
	it("validates user message", () => {
		const msg: any = { role: "user", content: "hello", timestamp: Date.now() };
		expect(validateMessage(msg)).toBe(true);
		expect(isUserMessage(msg)).toBe(true);
	});

	it("guards content types", () => {
		expect(isToolCall({ type: "toolCall", id: "1", name: "bash", arguments: {} })).toBe(true);
		expect(isThinking({ type: "thinking", thinking: "..." })).toBe(true);
	});
});
