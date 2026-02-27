import { describe, expect, it } from "vitest";
import { ToolRegistry } from "../../../src/agent/tools/registry.js";

describe("agent/tools/registry", () => {
	it("registers and creates tools", () => {
		const r = new ToolRegistry();
		r.register({ name: "x", label: "x", category: "core" }, () => ({ name: "x", label: "x" } as any));
		const t = r.create("x");
		expect(t.name).toBe("x");
	});
});
