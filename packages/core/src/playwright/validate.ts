import path from "node:path";
import type { PlaywrightModeConfigV1 } from "@hapergg/harness-comet-schema";
import { HarnessError } from "../errors.js";
import type { PackageManagerName } from "../package-manager.js";
import { validatePlaywrightIncidents } from "./incidents.js";
import { listPlaywrightTests, type ListedPlaywrightTest } from "./list.js";

export interface ValidatePlaywrightHarnessProjectOptions {
  root: string;
  playwright: PlaywrightModeConfigV1["playwright"];
  incidents?: PlaywrightModeConfigV1["incidents"];
  packageManager?: PackageManagerName;
  reporterModulePath?: string;
  runCommand?: (
    command: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv }
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export interface PlaywrightValidationResult {
  ok: boolean;
  assets: { tests: ListedPlaywrightTest[] };
  errors: HarnessError[];
  warnings: HarnessError[];
}

export async function validatePlaywrightHarnessProject(
  options: ValidatePlaywrightHarnessProjectOptions
): Promise<PlaywrightValidationResult> {
  const errors: HarnessError[] = [];
  const warnings: HarnessError[] = [];

  await requirePath(
    path.join(options.root, options.playwright.configFile),
    "PLAYWRIGHT_CONFIG_MISSING",
    errors
  );
  await requirePath(
    path.join(options.root, options.playwright.testDir),
    "PLAYWRIGHT_TEST_DIR_MISSING",
    errors
  );

  let tests: ListedPlaywrightTest[] = [];
  try {
    tests = await listPlaywrightTests({
      root: options.root,
      configFile: options.playwright.configFile,
      packageManager: options.packageManager,
      reporterModulePath: options.reporterModulePath,
      runCommand: options.runCommand
    });
  } catch (error) {
    errors.push(
      error instanceof HarnessError
        ? error
        : new HarnessError({
            code: "PLAYWRIGHT_LIST_FAILED",
            category: "playwright",
            message: error instanceof Error ? error.message : String(error)
          })
    );
  }

  if (tests.length === 0) {
    errors.push(
      new HarnessError({
        code: "PLAYWRIGHT_TESTS_MISSING",
        category: "selection",
        message: "No Playwright tests were collected"
      })
    );
  }

  if (!tests.some((test) => test.tags.includes("@harness"))) {
    warnings.push(
      new HarnessError({
        code: "PLAYWRIGHT_HARNESS_TAGS_MISSING",
        category: "playwright",
        message: "No Playwright tests are tagged with @harness"
      })
    );
  }

  const incidentResult = await validatePlaywrightIncidents(options.root, {
    incidentsDirectory:
      options.incidents?.directory ??
      (options.playwright.testDir === "tests"
        ? "tests/incidents"
        : path.join(options.playwright.testDir, "incidents")),
    requireIssueUrl: options.incidents?.requireIssueUrl ?? false,
    requireReadme: options.incidents?.requireReadme ?? true
  });
  errors.push(...incidentResult.errors);
  warnings.push(...incidentResult.warnings);

  return { ok: errors.length === 0, assets: { tests }, errors, warnings };
}

async function requirePath(file: string, code: string, errors: HarnessError[]): Promise<void> {
  try {
    await import("node:fs/promises").then((fs) => fs.access(file));
  } catch {
    errors.push(
      new HarnessError({
        code,
        category: "config",
        message: `Required path is missing: ${file}`,
        file
      })
    );
  }
}
