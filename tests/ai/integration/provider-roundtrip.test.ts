import { describe, expect, it } from "vitest";
import { transformMessages } from "../../../src/ai/providers/transform-messages.js";
import type { Message, Model } from "../../../src/ai/types.js";

describe("provider roundtrip integration", () => {
  it("keeps tool call/result flow coherent", () => {
    const model: Model<"openai-completions"> = {
      id: "m1",
      name: "model",
      api: "openai-completions",
      provider: "openai",
      baseUrl: "http://localhost",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1000,
      maxTokens: 100,
    };
    const messages: Message[] = [
      { role: "assistant", content: [{ type: "toolCall", id: "tc-1", name: "search", arguments: {} }], api: "openai-completions", provider: "openai", model: "m1", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: "toolUse", timestamp: Date.now() },
      { role: "toolResult", toolCallId: "tc-1", toolName: "search", content: [{ type: "text", text: "ok" }], isError: false, timestamp: Date.now() },
    ];
    const out = transformMessages(messages, model);
    expect(out.length).toBeGreaterThan(0);
  });
});
