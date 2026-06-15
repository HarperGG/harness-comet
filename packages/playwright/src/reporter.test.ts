import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import HarnessCometReporter from "./reporter.js";

describe("HarnessCometReporter", () => {
  it("writes normalized results with stable relative paths", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-reporter-"));
    const outputFile = path.join(root, "test-results", "harness-comet", "results.json");
    process.env.HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE = outputFile;
    process.env.HARNESS_COMET_PLAYWRIGHT_PROJECT_ROOT = root;

    try {
      const reporter = new HarnessCometReporter();
      await reporter.onBegin({}, {} as never);
      await reporter.onTestEnd(
        {
          title: "Example smoke",
          location: { file: path.join(root, "tests", "example.spec.ts") },
          tags: ["@b", "@a", "@a"],
          annotations: [{ type: "incident", description: "BUG-1" }],
          parent: { project: () => ({ name: "chromium" }) }
        } as never,
        {
          status: "passed",
          duration: 42,
          retry: 1,
          errors: [],
          attachments: [
            {
              name: "payload.json",
              contentType: "application/json",
              path: path.join(root, "test-results", "payload.json")
            }
          ]
        } as never
      );
      await reporter.onEnd();

      const parsed = JSON.parse(await fs.readFile(outputFile, "utf8")) as {
        schemaVersion: number;
        tests: Array<Record<string, unknown>>;
      };
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.tests).toEqual([
        {
          annotations: [{ description: "BUG-1", type: "incident" }],
          attachments: [
            {
              contentType: "application/json",
              name: "payload.json",
              path: "test-results/payload.json"
            }
          ],
          duration: 42,
          errors: [],
          file: "tests/example.spec.ts",
          project: "chromium",
          retry: 1,
          status: "passed",
          tags: ["@a", "@b"],
          title: "Example smoke"
        }
      ]);
    } finally {
      delete process.env.HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE;
      delete process.env.HARNESS_COMET_PLAYWRIGHT_PROJECT_ROOT;
    }
  });

  it("falls back to the default results path when no env override is provided", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-reporter-default-"));
    const outputFile = path.join(root, "test-results", "harness-comet", "results.json");
    process.env.HARNESS_COMET_PLAYWRIGHT_PROJECT_ROOT = root;

    try {
      const reporter = new HarnessCometReporter();
      await reporter.onBegin({}, {} as never);
      await reporter.onTestEnd(
        {
          title: "Example smoke",
          location: { file: path.join(root, "tests", "example.spec.ts") },
          tags: ["@harness"],
          annotations: [],
          parent: { project: () => ({ name: "chromium" }) }
        } as never,
        {
          status: "passed",
          duration: 10,
          retry: 0,
          errors: [],
          attachments: []
        } as never
      );
      await reporter.onEnd();

      const parsed = JSON.parse(await fs.readFile(outputFile, "utf8")) as {
        schemaVersion: number;
        tests: Array<Record<string, unknown>>;
      };
      expect(parsed.schemaVersion).toBe(1);
      expect(parsed.tests[0]).toEqual(
        expect.objectContaining({
          file: "tests/example.spec.ts",
          status: "passed",
          project: "chromium"
        })
      );
    } finally {
      delete process.env.HARNESS_COMET_PLAYWRIGHT_PROJECT_ROOT;
    }
  });
});
