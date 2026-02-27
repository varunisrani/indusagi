import { describe, expect, it } from "vitest";
import {
  API_NAMES,
  STOP_REASONS,
  isAssistantMessage,
  isMessage,
  isToolCall,
  isToolResultMessage,
  isUserMessage,
  validateContext,
} from "../../src/ai/types.js";

describe("ai/types guards and validators", () => {
  it("exposes constants", () => {
    expect(API_NAMES.length).toBeGreaterThan(0);
    expect(STOP_REASONS).toContain("stop");
  });

  it("detects message roles", () => {
    expect(isUserMessage({ role: "user", content: "hi", timestamp: Date.now() })).toBe(true);
    expect(isAssistantMessage({ role: "assistant", content: [], api: "x", provider: "y", model: "z", usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: "stop", timestamp: Date.now() })).toBe(true);
    expect(isToolResultMessage({ role: "toolResult", toolCallId: "1", toolName: "t", content: [], isError: false, timestamp: Date.now() })).toBe(true);
    expect(isMessage({ role: "nope" })).toBe(false);
  });

  it("detects tool call shape", () => {
    expect(isToolCall({ type: "toolCall", id: "a", name: "tool", arguments: {} })).toBe(true);
    expect(isToolCall({ type: "toolCall", id: "a" })).toBe(false);
  });

  it("validates context", () => {
    expect(() => validateContext({ messages: [{ role: "user", content: "hello", timestamp: Date.now() }] })).not.toThrow();
    expect(() => validateContext({ messages: [{}] })).toThrow();
  });
});
