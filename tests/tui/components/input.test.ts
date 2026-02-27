import { describe, expect, it } from "vitest";
import { Input } from "../../../src/tui/components/input.js";

describe("tui/components/input", () => {
	it("accepts typed input", () => {
		const c = new Input();
		c.handleInput("a");
		expect(c.getValue()).toBe("a");
	});
});
