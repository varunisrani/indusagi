import { describe, expect, it } from "vitest";
import { createBashTool } from "../../../src/agent/tools/bash.js";

describe("agent/tools/bash", () => {
	it("creates tool", () => {
		expect(createBashTool(process.cwd()).name).toBe("bash");
	});
});
