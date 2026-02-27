import { describe, expect, it } from "vitest";
import { streamProxy } from "../../src/agent/proxy.js";

describe("agent/proxy", () => {
	it("creates proxy stream", () => {
		const s = streamProxy({ id: "m", provider: "p", api: "a" } as any, { systemPrompt: "", messages: [] as any, tools: [] as any } as any, { authToken: "x", proxyUrl: "http://localhost" } as any);
		expect(s).toBeDefined();
	});
});
