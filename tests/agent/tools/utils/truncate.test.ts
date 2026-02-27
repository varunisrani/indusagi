import { describe, expect, it } from "vitest";
import { truncateHead } from "../../../../src/agent/tools/truncate.js";

describe("agent/tools/utils/truncate", () => {
	it("truncates by lines", () => {
		const out = truncateHead("a\nb\nc", { maxLines: 2 });
		expect(out.truncated).toBe(true);
	});
});
