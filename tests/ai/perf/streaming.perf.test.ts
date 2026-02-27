import { describe, expect, it } from "vitest";
import { parseStreamingJson } from "../../../src/ai/utils/json-parse.js";

describe("streaming perf smoke", () => {
  it("parses many chunks quickly", () => {
    const start = Date.now();
    for (let i = 0; i < 2000; i++) {
      parseStreamingJson('{"i":' + i + '}');
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(1500);
  });
});
