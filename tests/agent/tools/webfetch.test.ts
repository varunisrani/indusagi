import { describe, expect, it } from "vitest";
import { createWebFetchTool } from "../../../src/agent/tools/webfetch.js";

describe("agent/tools/webfetch", () => {
	it("creates tool", () => {
		expect(createWebFetchTool().name).toBe("webfetch");
	});
});
