import { describe, expect, test } from "bun:test";
import { usesConnectionModelCatalog } from "./connections-api";

describe("provider model catalog routing", () => {
  test("passthrough providers use the connection-scoped upstream catalog", () => {
    expect(usesConnectionModelCatalog({ passthroughModels: true })).toBe(true);
  });

  test("custom nodes and ordinary providers keep their existing behavior", () => {
    expect(usesConnectionModelCatalog({ isCustom: true })).toBe(true);
    expect(usesConnectionModelCatalog({ nodeType: "openai-compatible" })).toBe(true);
    expect(usesConnectionModelCatalog({})).toBe(false);
    expect(usesConnectionModelCatalog(null)).toBe(false);
  });
});
