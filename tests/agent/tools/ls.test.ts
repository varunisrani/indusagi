import { describe, expect, it } from "vitest";
import { createLsTool } from "../../../src/agent/tools/ls.js";

describe("agent/tools/ls", () => {
	it("creates tool", () => {
		expect(createLsTool(process.cwd()).name).toBe("ls");
	});
});
