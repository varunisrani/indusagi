import { describe, expect, it } from "vitest";
import { createToolRegistry } from "../../src/agent/tools/index.js";

describe("agent/tool-registry", () => {
	it("builds registry", () => {
		const r = createToolRegistry(process.cwd());
		expect(r.listMetadata().length).toBeGreaterThan(0);
	});
});
