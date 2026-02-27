import { describe, expect, it } from "vitest";
import { detectCapabilities } from "../../src/tui/terminal-image.js";

describe("tui/terminal-image", () => {
	it("detects capability object", () => {
		const caps = detectCapabilities();
		expect(caps).toHaveProperty("images");
		expect(caps).toHaveProperty("trueColor");
	});
});
