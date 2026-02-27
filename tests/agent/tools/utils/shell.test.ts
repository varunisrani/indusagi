import { describe, expect, it } from "vitest";
import { getShellConfig } from "../../../../src/agent/tools/utils/shell.js";

describe("agent/tools/utils/shell", () => {
	it("returns shell config", () => {
		expect(getShellConfig().shell.length).toBeGreaterThan(0);
	});
});
