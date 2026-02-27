import { describe, expect, it, vi } from "vitest";
import { SettingsList } from "../../../src/tui/components/settings-list.js";

const theme = {
	label: (s: string) => s,
	value: (s: string) => s,
	description: (s: string) => s,
	cursor: "> ",
	hint: (s: string) => s,
};

describe("tui/components/settings-list", () => {
	it("renders settings", () => {
		const c = new SettingsList([{ id: "a", label: "A", currentValue: "1" }], 5, theme, vi.fn(), vi.fn());
		expect(c.render(60).length).toBeGreaterThan(0);
	});
});
