import { describe, expect, it } from "vitest";
import { getOverflowSuggestion, isContextOverflow } from "../../../src/ai/utils/overflow.js";

describe("overflow detection", () => {
  it("detects overflow by error pattern", () => {
    const msg: any = { stopReason: "error", errorMessage: "input exceeds the context window", usage: { input: 0, cacheRead: 0 } };
    expect(isContextOverflow(msg)).toBe(true);
    expect(getOverflowSuggestion(msg.errorMessage)).toBeTruthy();
  });

  it("detects silent overflow via usage", () => {
    const msg: any = { stopReason: "stop", usage: { input: 1200, cacheRead: 0 } };
    expect(isContextOverflow(msg, 1000)).toBe(true);
  });
});
