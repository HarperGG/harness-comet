import { describe, expect, it } from "vitest";
import {
  PLAYWRIGHT_CREATE_DECISIONS,
  classifyPlaywrightAssetPath,
  isDecisionAllowedForMode,
  normalizePlaywrightDecision
} from "./playwright-impact-policy.js";

describe("playwright impact policy", () => {
  it("allows create only for full mode", () => {
    expect(PLAYWRIGHT_CREATE_DECISIONS.has("create")).toBe(true);
    expect(isDecisionAllowedForMode("full", "create")).toBe(true);
    expect(isDecisionAllowedForMode("maintain", "create")).toBe(false);
    expect(isDecisionAllowedForMode("off", "create")).toBe(false);
  });

  it("treats extend as allowed in maintain mode", () => {
    expect(isDecisionAllowedForMode("maintain", "extend")).toBe(true);
  });

  it("classifies spec files as playwright test assets", () => {
    expect(classifyPlaywrightAssetPath("tests/example.spec.ts")).toEqual({
      kind: "test-spec",
      managed: true
    });
  });

  it("classifies non-test docs as unmanaged", () => {
    expect(classifyPlaywrightAssetPath("docs/testing/README.md")).toEqual({
      kind: "other",
      managed: false
    });
  });

  it("normalizes unsupported decisions to none", () => {
    expect(normalizePlaywrightDecision(" CREATE ")).toBe("create");
    expect(normalizePlaywrightDecision("something-else")).toBe("none");
  });
});
