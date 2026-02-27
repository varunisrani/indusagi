import { describe, expect, it } from "vitest";
import { Editor } from "../../../src/tui/components/editor.js";

const tui = {
	requestRender: () => {},
	terminal: { rows: 40, columns: 120 },
} as any;

const theme = {
	borderColor: (s: string) => s,
	selectList: {
		selectedPrefix: (s: string) => s,
		selectedText: (s: string) => s,
		description: (s: string) => s,
		scrollInfo: (s: string) => s,
		noMatch: (s: string) => s,
	},
};

describe("tui/components/editor", () => {
	it("sets and gets text", () => {
		const c = new Editor(tui, theme);
		c.setText("hello");
		expect(c.getText()).toBe("hello");
	});
});
