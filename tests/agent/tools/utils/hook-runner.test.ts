import { describe, expect, it } from "vitest";
import { HookRunner } from "../../../../src/agent/tools/utils/hook-runner.js";

describe("agent/tools/utils/hook-runner", () => {
	it("runs hook handlers", async () => {
		const h = new HookRunner();
		h.register("x", async (_in, out: { n: number }) => ({ n: out.n + 1 }));
		const out = await h.trigger("x", {}, { n: 1 });
		expect(out.n).toBe(2);
	});
});
