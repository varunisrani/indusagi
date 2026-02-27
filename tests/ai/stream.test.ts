import { describe, expect, it, vi } from "vitest";
import { clearApiProviders, registerApiProvider } from "../../src/ai/api-registry.js";
import { StreamOptionsBuilder, completeSimple, stream, streamByApi } from "../../src/ai/stream.js";
import type { Model } from "../../src/ai/types.js";
import { createMockProvider } from "./mocks/provider-mocks.js";

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

describe("stream api", () => {
  it("builds stream options", () => {
    const options = new StreamOptionsBuilder().withTemperature(0.2).withMaxTokens(50).withHeader("x-test", "1").build();
    expect(options.temperature).toBe(0.2);
    expect(options.maxTokens).toBe(50);
    expect(options.headers?.["x-test"]).toBe("1");
  });

  it("validates context and streams", async () => {
    clearApiProviders();
    registerApiProvider(createMockProvider("test-api"));
    const result = await stream(model, { messages: [] }).result();
    expect(result.role).toBe("assistant");
  });

  it("logs when logger provided", async () => {
    clearApiProviders();
    registerApiProvider(createMockProvider("test-api"));
    const debug = vi.fn();
    await completeSimple(model, { messages: [] }, undefined, { debug });
    expect(debug).toHaveBeenCalled();
  });

  it("supports streamByApi convenience", async () => {
    clearApiProviders();
    registerApiProvider(createMockProvider("test-api"));
    const res = await streamByApi("test-api", model, { messages: [] }).result();
    expect(res.stopReason).toBe("stop");
  });
});
