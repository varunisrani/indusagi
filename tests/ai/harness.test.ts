import { describe, expect, it } from "vitest";
import { clearApiProviders, registerApiProvider } from "../../src/ai/api-registry.js";
import { stream } from "../../src/ai/stream.js";
import type { Model } from "../../src/ai/types.js";
import { createMockProvider } from "./mocks/provider-mocks.js";

describe("ai test harness", () => {
  it("streams with mock provider", async () => {
    clearApiProviders();
    registerApiProvider(createMockProvider("test-api"));

    const model: Model<"test-api"> = {
      id: "test-model",
      name: "Test Model",
      api: "test-api",
      provider: "openai",
      baseUrl: "http://localhost",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1024,
      maxTokens: 128,
    };

    const result = await stream(model, { messages: [] }).result();
    expect(result.content[0]).toMatchObject({ type: "text", text: "mock-response" });
  });
});
