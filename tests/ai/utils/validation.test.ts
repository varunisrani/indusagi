import { describe, expect, it } from "vitest";
import { getValidationDiagnostics, validateToolArguments } from "../../../src/ai/utils/validation.js";

describe("validation utils", () => {
  it("returns diagnostics", () => {
    const diag = getValidationDiagnostics();
    expect(typeof diag.ajvEnabled).toBe("boolean");
  });

  it("validates simple tool args", () => {
    const tool = {
      name: "sum",
      description: "sum numbers",
      parameters: {
        type: "object",
        properties: { a: { type: "number" }, b: { type: "number" } },
        required: ["a", "b"],
      },
    } as any;
    const args = validateToolArguments(tool, { type: "toolCall", id: "1", name: "sum", arguments: { a: 1, b: 2 } });
    expect(args).toMatchObject({ a: 1, b: 2 });
  });
});
