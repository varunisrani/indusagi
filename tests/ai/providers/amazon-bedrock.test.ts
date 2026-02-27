import { describe, expect, it } from "vitest";
import { BedrockRequestBuilder } from "../../../src/ai/providers/amazon-bedrock.js";
import type { Context, Model } from "../../../src/ai/types.js";

describe("bedrock request builder", () => {
  it("builds converse stream request", () => {
    const model: Model<"bedrock-converse-stream"> = {
      id: "anthropic.claude-3-haiku",
      name: "Bedrock Claude",
      api: "bedrock-converse-stream",
      provider: "amazon-bedrock",
      baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 200000,
      maxTokens: 4096,
    };
    const context: Context = { messages: [{ role: "user", content: "hello", timestamp: Date.now() }] };
    const request = new BedrockRequestBuilder(model, context, { maxTokens: 100 }).build();
    expect(request.modelId).toBe(model.id);
    expect(request.inferenceConfig?.maxTokens).toBe(100);
  });
});
