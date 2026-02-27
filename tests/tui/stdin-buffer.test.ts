import { describe, expect, it } from "vitest";
import { StdinBuffer } from "../../src/tui/stdin-buffer.js";

describe("tui/stdin-buffer", () => {
	it("emits complete escape sequence", () => {
		const b = new StdinBuffer({ timeout: 5 });
		const out: string[] = [];
		b.on("data", (d) => out.push(d));
		b.process("\x1b[A");
		expect(out).toContain("\x1b[A");
	});
});
