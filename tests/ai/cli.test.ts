import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("ai cli", () => {
  it("includes refresh command in help text", () => {
    const source = readFileSync(new URL("../../src/ai/cli.ts", import.meta.url), "utf8");
    expect(source).toContain("refresh [provider]");
    expect(source).toContain('command === "refresh"');
  });
});
