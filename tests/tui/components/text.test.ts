import { describe, expect, it } from "vitest";
import { Text } from "../../../src/tui/components/text.js";

describe("tui/components/text", () => {
	it("renders wrapped lines", () => {
		const c = new Text("hello world", 0, 0);
		const lines = c.render(5);
		expect(lines.length).toBeGreaterThan(1);
	});
});
