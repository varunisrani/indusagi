import { describe, expect, it, vi } from "vitest";
import { executeGoogleRequest, isThinkingPart, retainThoughtSignature } from "../../../src/ai/providers/google-shared.js";

describe("google shared helpers", () => {
  it("retains non-empty thought signature", () => {
    expect(retainThoughtSignature("abc", undefined)).toBe("abc");
    expect(retainThoughtSignature("abc", "xyz")).toBe("xyz");
  });

  it("detects thinking part", () => {
    expect(isThinkingPart({ thought: true, thoughtSignature: undefined })).toBe(true);
    expect(isThinkingPart({ thought: false, thoughtSignature: "sig" })).toBe(false);
  });

  it("executes request with hooks", async () => {
    const before = vi.fn();
    const after = vi.fn();
    const result = await executeGoogleRequest({ a: 1 }, async () => ({ ok: 1 }), {
      hooks: { onBeforeRequest: before, onAfterResponse: after },
    });
    expect(result).toEqual({ ok: 1 });
    expect(before).toHaveBeenCalled();
    expect(after).toHaveBeenCalled();
  });
});
