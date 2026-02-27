import { describe, expect, it } from "vitest";
import { createGrepTool } from "../../../src/agent/tools/grep.js";

describe("agent/tools/grep", () => {
	it("creates tool", () => {
		expect(createGrepTool(process.cwd()).name).toBe("grep");
	});
});
