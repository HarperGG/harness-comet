import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execa } from "execa";
import { HarnessError } from "../errors.js";
import { detectPackageManager, type PackageManagerName } from "../package-manager.js";
import { buildPlaywrightCommand } from "./runner.js";

export interface ListedPlaywrightTest {
  project?: string;
  file: string;
  title: string;
  tags: string[];
  annotations: Array<{
    type: string;
    description?: string;
  }>;
}

interface RunCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface ListPlaywrightTestsOptions {
  root: string;
  configFile: string;
  packageManager?: PackageManagerName;
  reporterModulePath?: string;
  runCommand?: (
    command: string,
    args: string[],
    options: { cwd: string; env: NodeJS.ProcessEnv }
  ) => Promise<RunCommandResult>;
}

export async function listPlaywrightTests(
  options: ListPlaywrightTestsOptions
): Promise<ListedPlaywrightTest[]> {
  const packageManager = options.packageManager ?? (await detectPackageManager(options.root));
  const reporterModulePath = options.reporterModulePath ?? resolveListReporterModulePath();
  const outputFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-list-output-")),
    "results.json"
  );
  const args = buildPlaywrightCommand({
    packageManager,
    configFile: options.configFile,
    args: ["--list", `--reporter=${reporterModulePath}`]
  });
  const runCommand = options.runCommand ?? defaultRunCommand;
  const result = await runCommand(packageManager, args, {
    cwd: options.root,
    env: {
      ...process.env,
      HARNESS_COMET_PLAYWRIGHT_LIST_OUTPUT_FILE: outputFile
    }
  });

  if (result.exitCode !== 0) {
    throw new HarnessError({
      code: "PLAYWRIGHT_LIST_FAILED",
      category: "playwright",
      message: result.stderr.trim() || result.stdout.trim() || "Playwright test listing failed",
      path: options.root
    });
  }

  try {
    const listed = JSON.parse(await fs.readFile(outputFile, "utf8")) as ListedPlaywrightTest[];
    return normalizeListedTests(listed);
  } catch (error) {
    throw new HarnessError({
      code: "PLAYWRIGHT_LIST_OUTPUT_INVALID",
      category: "playwright",
      message: error instanceof Error ? error.message : String(error),
      path: outputFile
    });
  }
}

function normalizeListedTests(tests: ListedPlaywrightTest[]): ListedPlaywrightTest[] {
  return [...tests]
    .map((test) => ({
      ...test,
      file: normalizePath(test.file),
      tags: [...new Set(test.tags)].sort(),
      annotations: [...test.annotations].sort(
        (left, right) =>
          left.type.localeCompare(right.type) ||
          (left.description ?? "").localeCompare(right.description ?? "")
      )
    }))
    .sort(
      (left, right) =>
        left.file.localeCompare(right.file) ||
        left.title.localeCompare(right.title) ||
        (left.project ?? "").localeCompare(right.project ?? "")
    );
}

function resolveListReporterModulePath(): string {
  const require = createRequire(import.meta.url);
  try {
    return require.resolve("@harness-comet/playwright/list-reporter");
  } catch {
    return new URL("../../../playwright/dist/list-reporter.js", import.meta.url).pathname;
  }
}

async function defaultRunCommand(
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv }
): Promise<RunCommandResult> {
  const result = await execa(command, args, {
    cwd: options.cwd,
    env: options.env,
    reject: false
  });
  return {
    exitCode: result.exitCode ?? 1,
    stdout: result.stdout,
    stderr: result.stderr
  };
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}
