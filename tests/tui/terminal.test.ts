import { describe, expect, it } from "vitest";
import { CapabilitiesDetector } from "../../src/tui/terminal.js";

describe("tui/terminal", () => {
	it("returns capabilities", () => {
		const d = new CapabilitiesDetector();
		const caps = d.detect(false);
		expect(caps).toHaveProperty("bracketedPaste", true);
	});
});
