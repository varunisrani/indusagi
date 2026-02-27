import { describe, expect, it } from "vitest";
import { OpenAICompatibilityAdapter } from "../../../src/ai/providers/openai-completions.js";
import type { Model } from "../../../src/ai/types.js";

describe("openai completions compatibility adapter", () => {
  it("normalizes mistral tool ids when configured", () => {
    const model: Model<"openai-completions"> = {
      id: "mistral-medium",
      name: "Mistral",
      api: "openai-completions",
      provider: "mistral",
      baseUrl: "https://api.mistral.ai/v1",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 1000,
      maxTokens: 200,
      compat: { requiresMistralToolIds: true },
    };

    const adapter = new OpenAICompatibilityAdapter(model);
    const normalized = adapter.normalizeToolCallId("abc-very_long_id!!!");
    expect(normalized).toMatch(/^[a-zA-Z0-9]{9}$/);
  });
});
