import { describe, expect, it } from "vitest";
import { Container } from "../../src/tui/tui.js";
import { Text } from "../../src/tui/components/text.js";

describe("tui/tui", () => {
	it("renders container children", () => {
		const c = new Container();
		c.addChild(new Text("ok", 0, 0));
		expect(c.render(20).length).toBeGreaterThan(0);
	});
});
