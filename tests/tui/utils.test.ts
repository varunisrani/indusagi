import { describe, expect, it } from "vitest";
import { visibleWidth } from "../../src/tui/utils.js";

describe("tui/utils", () => {
	it("measures ascii width", () => {
		expect(visibleWidth("hello")).toBe(5);
	});
});
