import { describe, expect, it } from "vitest";
import { createFindTool } from "../../../src/agent/tools/find.js";

describe("agent/tools/find", () => {
	it("creates tool", () => {
		expect(createFindTool(process.cwd()).name).toBe("find");
	});
});
