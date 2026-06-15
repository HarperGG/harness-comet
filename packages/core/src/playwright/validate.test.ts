import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validatePlaywrightHarnessProject } from "./validate.js";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-validate-"));
}

describe("validatePlaywrightHarnessProject", () => {
  it("passes with config, test dir, playwright config, and metadata", async () => {
    const root = await tempProject();
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default {};");
    await fs.writeFile(
      path.join(root, "tests", "example.spec.ts"),
      `import { defineHarnessScenario } from "@harness-comet/playwright";
       defineHarnessScenario({
         id: "example-smoke",
         title: "Example smoke",
         component: "example",
         capability: "render-page",
         behavior: "show-page",
         contract: "example-page-visible"
       });`
    );

    const result = await validatePlaywrightHarnessProject({
      root,
      playwright: {
        configFile: "playwright.config.ts",
        testDir: "tests",
        testMatch: ["**/*.spec.ts"]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.assets.tests).toHaveLength(1);
  });

  it("fails when no scenario metadata exists", async () => {
    const root = await tempProject();
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default {};");
    await fs.writeFile(path.join(root, "tests", "example.spec.ts"), `import { test } from "@playwright/test";`);

    const result = await validatePlaywrightHarnessProject({
      root,
      playwright: {
        configFile: "playwright.config.ts",
        testDir: "tests",
        testMatch: ["**/*.spec.ts"]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("PLAYWRIGHT_METADATA_MISSING");
  });
});
