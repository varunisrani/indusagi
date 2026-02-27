import { describe, expect, it } from "vitest";
import { createWriteTool } from "../../../src/agent/tools/write.js";

describe("agent/tools/write", () => {
	it("creates tool", () => {
		expect(createWriteTool(process.cwd()).name).toBe("write");
	});
});
