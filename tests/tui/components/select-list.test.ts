import { describe, expect, it } from "vitest";
import { SelectList } from "../../../src/tui/components/select-list.js";

const theme = {
	selectedPrefix: (s: string) => s,
	selectedText: (s: string) => s,
	description: (s: string) => s,
	scrollInfo: (s: string) => s,
	noMatch: (s: string) => s,
};

describe("tui/components/select-list", () => {
	it("renders items", () => {
		const c = new SelectList([{ value: "a", label: "A" }], 5, theme);
		expect(c.render(40).length).toBeGreaterThan(0);
	});
});
