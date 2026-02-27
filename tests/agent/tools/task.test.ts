import { describe, expect, it } from "vitest";
import { createTaskTool } from "../../../src/agent/tools/task.js";

describe("agent/tools/task", () => {
	it("creates tool", () => {
		expect(createTaskTool().name).toBe("task");
	});
});
