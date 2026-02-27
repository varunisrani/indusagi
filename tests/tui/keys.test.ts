import { describe, expect, it } from "vitest";
import { normalizeKeyId, parseKey } from "../../src/tui/keys.js";

describe("tui/keys", () => {
	it("normalizes aliases", () => {
		expect(normalizeKeyId("esc")).toBe("escape");
		expect(normalizeKeyId("return")).toBe("enter");
	});

	it("parses legacy enter", () => {
		expect(parseKey("\r")).toBe("enter");
	});
});
