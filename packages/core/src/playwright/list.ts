import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
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
  const reporter = options.reporterModulePath ?? "json";
  const outputFile = path.join(
    await fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-list-output-")),
    "results.json"
  );
  const args = buildPlaywrightCommand({
    packageManager,
    configFile: options.configFile,
    args: ["--list", `--reporter=${reporter}`]
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
    const listed = options.reporterModulePath
      ? (JSON.parse(await fs.readFile(outputFile, "utf8")) as ListedPlaywrightTest[])
      : parsePlaywrightJsonListOutput(result.stdout);
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

interface PlaywrightJsonListReport {
  suites?: PlaywrightJsonSuite[];
}

interface PlaywrightJsonSuite {
  file?: string;
  suites?: PlaywrightJsonSuite[];
  specs?: PlaywrightJsonSpec[];
}

interface PlaywrightJsonSpec {
  file?: string;
  title?: string;
  tags?: unknown[];
  tests?: PlaywrightJsonTest[];
}

interface PlaywrightJsonTest {
  projectName?: string;
  annotations?: unknown[];
}

function parsePlaywrightJsonListOutput(stdout: string): ListedPlaywrightTest[] {
  const report = JSON.parse(stdout) as PlaywrightJsonListReport;
  return (report.suites ?? []).flatMap((suite) => collectJsonSuiteTests(suite));
}

function collectJsonSuiteTests(
  suite: PlaywrightJsonSuite,
  inheritedFile?: string
): ListedPlaywrightTest[] {
  const file = suite.file ?? inheritedFile ?? "";
  return [
    ...(suite.specs ?? []).flatMap((spec) => toListedJsonSpec(spec, spec.file ?? file)),
    ...(suite.suites ?? []).flatMap((child) => collectJsonSuiteTests(child, file))
  ];
}

function toListedJsonSpec(spec: PlaywrightJsonSpec, file: string): ListedPlaywrightTest[] {
  return (spec.tests?.length ? spec.tests : [{}]).map((test) => ({
    project: test.projectName || undefined,
    file,
    title: spec.title ?? "",
    tags: normalizePlaywrightJsonTags(spec.tags),
    annotations: normalizePlaywrightJsonAnnotations(test.annotations)
  }));
}

function normalizePlaywrightJsonTags(tags: unknown[] | undefined): string[] {
  return (tags ?? [])
    .filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
    .map((tag) => (tag.startsWith("@") ? tag : `@${tag}`));
}

function normalizePlaywrightJsonAnnotations(
  annotations: unknown[] | undefined
): ListedPlaywrightTest["annotations"] {
  return (annotations ?? [])
    .filter(
      (
        annotation
      ): annotation is {
        type: string;
        description?: unknown;
      } =>
        Boolean(annotation) &&
        typeof annotation === "object" &&
        typeof (annotation as { type?: unknown }).type === "string"
    )
    .map((annotation) => ({
      type: annotation.type,
      description: typeof annotation.description === "string" ? annotation.description : undefined
    }));
}

function normalizeListedTests(tests: ListedPlaywrightTest[]): ListedPlaywrightTest[] {
  return [...tests]
    .map((test) => ({
      ...test,
      file: normalizePath(test.file),
      tags: [...new Set(test.tags.map((tag) => (tag.startsWith("@") ? tag : `@${tag}`)))].sort(),
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
