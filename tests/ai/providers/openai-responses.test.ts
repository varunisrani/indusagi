import { describe, expect, it, vi } from "vitest";
import { executeOpenAIRequest } from "../../../src/ai/providers/openai-responses-shared.js";

describe("openai responses shared execution", () => {
  it("runs hooks around request execution", async () => {
    const onBeforeRequest = vi.fn();
    const onAfterResponse = vi.fn();

    const response = await executeOpenAIRequest(
      { input: "hello" },
      async () => ({ ok: true }),
      { hooks: { onBeforeRequest, onAfterResponse } },
    );

    expect(response).toEqual({ ok: true });
    expect(onBeforeRequest).toHaveBeenCalledTimes(1);
    expect(onAfterResponse).toHaveBeenCalledTimes(1);
  });

  it("normalizes and throws errors", async () => {
    await expect(
      executeOpenAIRequest({ input: "x" }, async () => {
        throw new Error("rate limit exceeded");
      }),
    ).rejects.toThrow(/rate limit/i);
  });
});
