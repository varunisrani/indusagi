import { describe, expect, it } from "vitest";
import { createEditTool } from "../../../src/agent/tools/edit.js";

describe("agent/tools/edit", () => {
	it("creates tool", () => {
		expect(createEditTool(process.cwd()).name).toBe("edit");
	});
});
