import { describe, expect, it } from "vitest";
import { ModelRegistry, estimateCost, findModels, registerCustomModel } from "../../src/ai/models.js";
import type { Model } from "../../src/ai/types.js";

describe("models registry", () => {
  it("finds models with filters", () => {
    const models = findModels({ supportsImageInput: true });
    expect(Array.isArray(models)).toBe(true);
  });

  it("estimates cost", () => {
    const model = findModels({})[0];
    const cost = estimateCost(model, { inputTokens: 1000, outputTokens: 500 });
    expect(cost.total).toBeGreaterThanOrEqual(0);
  });

  it("supports custom model registration", () => {
    const custom: Model<"openai-completions"> = {
      id: "custom-model",
      name: "Custom Model",
      api: "openai-completions",
      provider: "openai",
      baseUrl: "https://api.openai.com/v1",
      reasoning: true,
      input: ["text"],
      cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 100000,
      maxTokens: 4096,
    };

    registerCustomModel(custom);
    const found = findModels({ nameIncludes: "Custom" });
    expect(found.some((m) => m.id === "custom-model")).toBe(true);
  });

  it("supports independent registry instance", () => {
    const registry = new ModelRegistry();
    const providers = registry.getProviders();
    expect(providers.length).toBeGreaterThan(0);
  });
});
