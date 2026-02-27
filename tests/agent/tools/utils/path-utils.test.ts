import { describe, expect, it } from "vitest";
import { resolveToCwd } from "../../../../src/agent/tools/path-utils.js";

describe("agent/tools/utils/path-utils", () => {
	it("resolves relative path", () => {
		const p = resolveToCwd("a.txt", "/tmp");
		expect(p.endsWith("/tmp/a.txt") || p.endsWith("\\tmp\\a.txt")).toBe(true);
	});
});
