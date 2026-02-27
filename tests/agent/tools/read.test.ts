import { describe, expect, it } from "vitest";
import { createReadTool } from "../../../src/agent/tools/read.js";

describe("agent/tools/read", () => {
	it("creates tool", () => {
		expect(createReadTool(process.cwd()).name).toBe("read");
	});
});
