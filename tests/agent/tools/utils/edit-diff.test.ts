import { describe, expect, it } from "vitest";
import { computeEditDiff } from "../../../../src/agent/tools/edit-diff.js";

describe("agent/tools/utils/edit-diff", () => {
	it("returns error for missing file", async () => {
		const d = await computeEditDiff("missing.txt", "a", "b", process.cwd());
		expect("error" in d).toBe(true);
	});
});
