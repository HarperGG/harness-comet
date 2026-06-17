import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listPlaywrightTests } from "./list.js";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-list-"));
}

describe("listPlaywrightTests", () => {
  it("parses reporter output and sorts tests stably", async () => {
    const root = await tempProject();
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ packageManager: "npm@10.8.2" }, null, 2)
    );

    const tests = await listPlaywrightTests({
      root,
      configFile: "playwright.config.ts",
      reporterModulePath: "/tmp/list-reporter.js",
      runCommand: async (_command, _args, options) => {
        await fs.writeFile(
          options.env.HARNESS_COMET_PLAYWRIGHT_LIST_OUTPUT_FILE!,
          JSON.stringify([
            {
              file: "tests/b.spec.ts",
              title: "second test",
              tags: ["@b"],
              annotations: []
            },
            {
              project: "chromium",
              file: "tests/a.spec.ts",
              title: "first test",
              tags: ["@harness", "@a"],
              annotations: [{ type: "incident", description: "BUG-1" }]
            }
          ]),
          "utf8"
        );
        return { exitCode: 0, stdout: "", stderr: "" };
      }
    });

    expect(tests).toEqual([
      {
        project: "chromium",
        file: "tests/a.spec.ts",
        title: "first test",
        tags: ["@a", "@harness"],
        annotations: [{ type: "incident", description: "BUG-1" }]
      },
      {
        file: "tests/b.spec.ts",
        title: "second test",
        tags: ["@b"],
        annotations: []
      }
    ]);
  });

  it("parses Playwright JSON list output from stdout", async () => {
    const root = await tempProject();

    const tests = await listPlaywrightTests({
      root,
      configFile: "playwright.config.ts",
      packageManager: "pnpm",
      runCommand: async () => ({
        exitCode: 0,
        stdout: JSON.stringify({
          suites: [
            {
              title: "tests/example.spec.ts",
              file: "tests/example.spec.ts",
              specs: [
                {
                  title: "Example save flow",
                  tags: ["harness", "annotation-save"],
                  tests: [
                    {
                      projectName: "chromium",
                      annotations: [{ type: "incident", description: "BUG-1" }]
                    }
                  ]
                }
              ]
            }
          ]
        }),
        stderr: ""
      })
    });

    expect(tests).toEqual([
      {
        project: "chromium",
        file: "tests/example.spec.ts",
        title: "Example save flow",
        tags: ["@annotation-save", "@harness"],
        annotations: [{ type: "incident", description: "BUG-1" }]
      }
    ]);
  });

  it("fails when the listing command fails", async () => {
    const root = await tempProject();

    await expect(
      listPlaywrightTests({
        root,
        configFile: "playwright.config.ts",
        reporterModulePath: "/tmp/list-reporter.js",
        packageManager: "pnpm",
        runCommand: async () => ({ exitCode: 1, stdout: "", stderr: "boom" })
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: "PLAYWRIGHT_LIST_FAILED",
        category: "playwright"
      })
    );
  });
});
