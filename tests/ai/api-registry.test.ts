import { describe, expect, it } from "vitest";
import {
  clearApiProviders,
  disableApiProvider,
  enableApiProvider,
  getApiProvider,
  getApiProviderWithMetadata,
  registerApiProvider,
  unregisterApiProviders,
} from "../../src/ai/api-registry.js";
import { createMockProvider } from "./mocks/provider-mocks.js";

describe("api registry", () => {
  it("registers provider with metadata", () => {
    clearApiProviders();
    registerApiProvider(createMockProvider("test-api"), { sourceId: "tests", version: "1.0.0" });
    const entry = getApiProviderWithMetadata("test-api");
    expect(entry?.metadata.sourceId).toBe("tests");
    expect(entry?.metadata.version).toBe("1.0.0");
    expect(entry?.metadata.enabled).toBe(true);
  });

  it("can disable/enable provider", () => {
    clearApiProviders();
    registerApiProvider(createMockProvider("test-api"));
    expect(getApiProvider("test-api")).toBeTruthy();
    disableApiProvider("test-api");
    expect(getApiProvider("test-api")).toBeUndefined();
    enableApiProvider("test-api");
    expect(getApiProvider("test-api")).toBeTruthy();
  });

  it("can unregister by source", () => {
    clearApiProviders();
    registerApiProvider(createMockProvider("test-a"), { sourceId: "src-a" });
    registerApiProvider(createMockProvider("test-b"), { sourceId: "src-b" });
    unregisterApiProviders("src-a");
    expect(getApiProvider("test-a")).toBeUndefined();
    expect(getApiProvider("test-b")).toBeTruthy();
  });
});
