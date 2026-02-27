import { describe, expect, it } from "vitest";
import { EditorKeybindingsManager } from "../../src/tui/keybindings.js";

describe("tui/keybindings", () => {
	it("detects conflicts", () => {
		const manager = new EditorKeybindingsManager({
			submit: "ctrl+j",
			selectConfirm: "ctrl+j",
		});
		const conflicts = manager.detectConflicts();
		expect(conflicts.some((c) => c.key === "ctrl+j")).toBe(true);
	});

	it("applies vim preset mappings", () => {
		const manager = new EditorKeybindingsManager({}, "vim");
		expect(manager.getKeys("cursorUp")).toContain("k");
	});
});
