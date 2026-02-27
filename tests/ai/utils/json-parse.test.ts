import { describe, expect, it } from "vitest";
import { parseStreamingJson, parseStreamingJsonWithDiagnostics } from "../../../src/ai/utils/json-parse.js";

describe("streaming json parse", () => {
  it("parses complete json", () => {
    expect(parseStreamingJson('{"a":1}')).toMatchObject({ a: 1 });
  });

  it("parses partial json with diagnostics", () => {
    const result = parseStreamingJsonWithDiagnostics('{"a":', { allowPartial: true });
    expect(result.usedPartialParser).toBe(true);
  });

  it("returns fallback for invalid json when partial disabled", () => {
    const result = parseStreamingJsonWithDiagnostics('not json', { allowPartial: false, fallbackValue: { ok: false } });
    expect(result.value).toMatchObject({ ok: false });
    expect(result.parsed).toBe(false);
  });
});
