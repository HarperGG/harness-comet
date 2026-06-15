import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validatePlaywrightHarnessProject } from "./validate.js";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-validate-"));
}

describe("validatePlaywrightHarnessProject", () => {
  it("passes with config, test dir, playwright config, and collected tests", async () => {
    const root = await tempProject();
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default {};");

    const result = await validatePlaywrightHarnessProject({
      root,
      playwright: {
        configFile: "playwright.config.ts",
        testDir: "tests",
        testMatch: ["**/*.spec.ts"],
        assetRoots: ["tests"],
        resultsFile: "test-results/harness-comet/results.json"
      },
      packageManager: "pnpm",
      reporterModulePath: "/tmp/list-reporter.js",
      runCommand: async (_command, _args, options) => {
        await fs.writeFile(
          options.env.HARNESS_COMET_PLAYWRIGHT_LIST_OUTPUT_FILE!,
          JSON.stringify([
            {
              file: "tests/example.spec.ts",
              title: "Example smoke",
              tags: ["@harness"],
              annotations: []
            }
          ]),
          "utf8"
        );
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    });

    expect(result.ok).toBe(true);
    expect(result.assets.tests).toHaveLength(1);
  });

  it("fails when no tests are collected", async () => {
    const root = await tempProject();
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default {};");

    const result = await validatePlaywrightHarnessProject({
      root,
      playwright: {
        configFile: "playwright.config.ts",
        testDir: "tests",
        testMatch: ["**/*.spec.ts"],
        assetRoots: ["tests"],
        resultsFile: "test-results/harness-comet/results.json"
      },
      packageManager: "pnpm",
      reporterModulePath: "/tmp/list-reporter.js",
      runCommand: async (_command, _args, options) => {
        await fs.writeFile(options.env.HARNESS_COMET_PLAYWRIGHT_LIST_OUTPUT_FILE!, "[]", "utf8");
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("PLAYWRIGHT_TESTS_MISSING");
  });
});
