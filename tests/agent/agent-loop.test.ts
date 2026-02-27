import { describe, expect, it } from "vitest";
import { agentLoop } from "../../src/agent/agent-loop.js";

describe("agent/agent-loop", () => {
	it("exports function", () => {
		expect(typeof agentLoop).toBe("function");
	});
});
