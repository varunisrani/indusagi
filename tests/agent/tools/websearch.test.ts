import { describe, expect, it } from "vitest";
import { createWebSearchTool } from "../../../src/agent/tools/websearch.js";

describe("agent/tools/websearch", () => {
	it("creates tool", () => {
		expect(createWebSearchTool().name).toBe("websearch");
	});
});
