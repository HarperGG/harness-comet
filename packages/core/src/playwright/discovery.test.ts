import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverPlaywrightHarnessAssets } from "./discovery.js";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-discovery-"));
}

describe("discoverPlaywrightHarnessAssets", () => {
  it("finds spec files and extracts defineHarnessScenario metadata", async () => {
    const root = await tempProject();
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(
      path.join(root, "tests", "example.spec.ts"),
      `import { defineHarnessScenario } from "@hapergg/harness-comet-playwright";
       const scenario = defineHarnessScenario({
         id: "example-smoke",
         title: "Example smoke",
         component: "example",
         capability: "render-page",
         behavior: "show-example-page",
         contract: "example-page-visible"
       });`
    );

    const assets = await discoverPlaywrightHarnessAssets({
      root,
      testDir: "tests",
      testMatch: ["**/*.spec.ts"]
    });

    expect(assets.tests).toHaveLength(1);
    expect(assets.tests[0].scenarios[0].id).toBe("example-smoke");
  });
});
