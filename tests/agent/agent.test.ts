import { describe, expect, it } from "vitest";
import { Agent } from "../../src/agent/agent.js";

describe("agent/agent", () => {
	it("constructs", () => {
		const a = new Agent();
		expect(a.state).toBeDefined();
	});
});
