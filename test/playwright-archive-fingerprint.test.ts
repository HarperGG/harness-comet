import { describe, expect, it } from "vitest";
import { matchesPlaywrightArchiveFingerprint } from "../packages/comet-adapter/src/playwright-archive-fingerprint.js";

describe("Playwright archive fingerprint", () => {
  const receipt = {
    action: "update-or-create",
    status: "passed",
    configHash: "config-a",
    assetHash: "assets-a",
    targetTests: ["tests/menu.spec.ts"]
  };

  it("ignores repository tree hash churn", () => {
    expect(
      matchesPlaywrightArchiveFingerprint(receipt, {
        action: "update-or-create",
        status: "passed",
        configHash: "config-a",
        assetHash: "assets-a",
        targetTests: ["tests/menu.spec.ts"]
      })
    ).toBe(true);
  });

  it("rejects changed Playwright assets", () => {
    expect(
      matchesPlaywrightArchiveFingerprint(receipt, {
        action: "update-or-create",
        status: "passed",
        configHash: "config-a",
        assetHash: "assets-b",
        targetTests: ["tests/menu.spec.ts"]
      })
    ).toBe(false);
  });

  it("rejects changed target tests", () => {
    expect(
      matchesPlaywrightArchiveFingerprint(receipt, {
        action: "update-or-create",
        status: "passed",
        configHash: "config-a",
        assetHash: "assets-a",
        targetTests: ["tests/sidebar.spec.ts"]
      })
    ).toBe(false);
  });
});
