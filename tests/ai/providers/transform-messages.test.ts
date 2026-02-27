import { describe, expect, it, vi } from "vitest";
import { MessageTransformationPipeline, transformMessages } from "../../../src/ai/providers/transform-messages.js";
import type { Message, Model } from "../../../src/ai/types.js";

const model: Model<"openai-completions"> = {
  id: "gpt-test",
  name: "GPT Test",
  api: "openai-completions",
  provider: "openai",
  baseUrl: "http://localhost",
  reasoning: true,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 1000,
  maxTokens: 200,
};

describe("transform-messages pipeline", () => {
  it("normalizes ids and injects missing tool results", () => {
    const messages: Message[] = [
      {
        role: "assistant",
        content: [{ type: "toolCall", id: "orig-id", name: "search", arguments: {} }],
        api: "openai-completions",
        provider: "openai",
        model: "gpt-test",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
        stopReason: "toolUse",
        timestamp: Date.now(),
      },
      { role: "user", content: "continue", timestamp: Date.now() },
    ];

    const transformed = transformMessages(messages, { ...model, id: "other-model" }, (id) => `norm-${id}`);
    expect(transformed.some((m) => m.role === "toolResult")).toBe(true);
  });

  it("supports pipeline debug hooks", () => {
    const pipeline = new MessageTransformationPipeline<typeof model.api>();
    const debug = vi.fn();
    const result = pipeline.transform([{ role: "user", content: "hi", timestamp: Date.now() }], { model, debug });
    expect(result.length).toBe(1);
    expect(debug).not.toHaveBeenCalled();
  });
});
