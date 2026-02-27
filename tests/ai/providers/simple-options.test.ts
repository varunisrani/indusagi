import { describe, expect, it } from "vitest";
import { clampReasoning, mapThinkingLevel } from "../../../src/ai/providers/simple-options.js";

describe("simple-options thinking mapping", () => {
	it("clamps xhigh when provider does not support it", () => {
		expect(clampReasoning("xhigh")).toBe("high");
		expect(mapThinkingLevel("xhigh", "clamp-xhigh")).toBe("high");
	});

	it("preserves level when provider supports xhigh", () => {
		expect(mapThinkingLevel("xhigh", "supports-xhigh")).toBe("xhigh");
		expect(mapThinkingLevel("medium", "supports-xhigh")).toBe("medium");
	});
});
