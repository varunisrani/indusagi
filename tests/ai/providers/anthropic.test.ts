import { describe, expect, it, vi } from "vitest";
import { AnthropicRequestBuilder, AnthropicStreamHandler } from "../../../src/ai/providers/anthropic.js";
import type { Context, Model } from "../../../src/ai/types.js";

describe("anthropic provider helpers", () => {
  const model: Model<"anthropic-messages"> = {
    id: "claude-test",
    name: "Claude Test",
    api: "anthropic-messages",
    provider: "anthropic",
    baseUrl: "https://api.anthropic.com",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 4096,
  };

  it("builds anthropic request params", () => {
    const context: Context = { systemPrompt: "sys", messages: [{ role: "user", content: "hello", timestamp: Date.now() }] };
    const params = new AnthropicRequestBuilder(model, context, false, { maxTokens: 512 }).build();
    expect(params.model).toBe("claude-test");
    expect(params.max_tokens).toBe(512);
  });

  it("processes stream events via handler", async () => {
    async function* source() {
      yield { type: "message_start" };
      yield { type: "message_delta" };
    }
    const handler = new AnthropicStreamHandler();
    const spy = vi.fn();
    await handler.process(source(), spy);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
