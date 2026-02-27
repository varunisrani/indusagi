import { describe, expect, it } from "vitest";
import { isLikelyValidApiKey, resolveEnvApiKey, rotateEnvApiKey } from "../../src/ai/env-api-keys.js";

describe("env api keys", () => {
  it("validates api key shape", () => {
    expect(isLikelyValidApiKey(undefined)).toBe(false);
    expect(isLikelyValidApiKey("short")).toBe(false);
    expect(isLikelyValidApiKey("long-enough-api-key")).toBe(true);
  });

  it("resolves with metadata", () => {
    const result = resolveEnvApiKey("openai");
    expect(result.provider).toBe("openai");
    expect(typeof result.isValid).toBe("boolean");
  });

  it("rotates to fallback when invalid", () => {
    const value = rotateEnvApiKey("unknown-provider", "fallback-key");
    expect(value).toBe("fallback-key");
  });
});
