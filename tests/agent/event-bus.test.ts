import { describe, expect, it } from "vitest";
import { AgentEventBus } from "../../src/agent/event-bus.js";

describe("agent/event-bus", () => {
	it("subscribes and emits", () => {
		const bus = new AgentEventBus();
		let count = 0;
		bus.subscribe(() => count++);
		bus.emit({ type: "agent_start" });
		expect(count).toBe(1);
	});
});
