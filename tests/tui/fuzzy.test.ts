import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyMatch } from "../../src/tui/fuzzy.js";

describe("tui/fuzzy", () => {
	it("matches swapped alphanumeric query", () => {
		const match = fuzzyMatch("abc123", "123abc");
		expect(match.matches).toBe(true);
	});

	it("filters and sorts by fuzzy score", () => {
		const items = ["src/tui/tui.ts", "src/ai/index.ts", "README.md"];
		const out = fuzzyFilter(items, "tui", (x) => x);
		expect(out[0]).toBe("src/tui/tui.ts");
	});
});
