import fs from "node:fs/promises";
import path from "node:path";
import type {
  HarnessPlaywrightResultsV1,
  PlaywrightResultAttachmentV1,
  PlaywrightResultErrorV1,
  PlaywrightTestResultV1
} from "@harness-comet/schema";

type ReporterTestLike = {
  title?: string;
  tags?: unknown[];
  annotations?: unknown[];
  location?: { file?: string };
  parent?: { project?: () => { name?: string } | undefined };
  _projectName?: string;
};

type ReporterResultLike = {
  status?: string;
  duration?: number;
  retry?: number;
  errors?: unknown[];
  attachments?: unknown[];
};

export default class HarnessCometReporter {
  private readonly entries: PlaywrightTestResultV1[] = [];

  async onBegin(_config?: unknown, _suite?: unknown): Promise<void> {
    const outputFile = process.env.HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE;
    if (!outputFile) return;
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
  }

  async onTestEnd(test: ReporterTestLike, result: ReporterResultLike): Promise<void> {
    if (!process.env.HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE) return;
    this.entries.push(normalizeEntry(test, result));
  }

  async onEnd(): Promise<void> {
    const outputFile = process.env.HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE;
    if (!outputFile) return;

    const payload: HarnessPlaywrightResultsV1 = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      tests: [...this.entries].sort(compareEntries)
    };
    const tempFile = `${outputFile}.tmp`;
    await fs.writeFile(tempFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await fs.rename(tempFile, outputFile);
  }
}

function normalizeEntry(test: ReporterTestLike, result: ReporterResultLike): PlaywrightTestResultV1 {
  return {
    project: readProjectName(test),
    file: normalizeFilePath(test.location?.file ?? ""),
    title: test.title ?? "",
    tags: normalizeStringArray(test.tags),
    annotations: normalizeAnnotations(test.annotations),
    status: normalizeStatus(result.status),
    duration: Math.max(0, Math.trunc(result.duration ?? 0)),
    retry: Math.max(0, Math.trunc(result.retry ?? 0)),
    errors: normalizeErrors(result.errors),
    attachments: normalizeAttachments(result.attachments)
  };
}

function readProjectName(test: ReporterTestLike): string | undefined {
  return test.parent?.project?.()?.name ?? test._projectName;
}

function normalizeStringArray(values: unknown[] | undefined): string[] {
  return [...new Set((values ?? []).filter((value): value is string => typeof value === "string"))].sort();
}

function normalizeAnnotations(values: unknown[] | undefined): PlaywrightTestResultV1["annotations"] {
  return (values ?? [])
    .filter(
      (
        value
      ): value is {
        type: string;
        description?: string;
      } => Boolean(value) && typeof value === "object" && typeof (value as { type?: unknown }).type === "string"
    )
    .map((value) => ({
      type: value.type,
      description: typeof value.description === "string" ? value.description : undefined
    }))
    .sort(
      (left, right) =>
        left.type.localeCompare(right.type) ||
        (left.description ?? "").localeCompare(right.description ?? "")
    );
}

function normalizeErrors(values: unknown[] | undefined): PlaywrightResultErrorV1[] {
  return (values ?? [])
    .filter((value): value is { message?: unknown; value?: unknown; stack?: unknown } => Boolean(value))
    .map((value) => ({
      message:
        typeof value.message === "string"
          ? value.message
          : typeof value.value === "string"
            ? value.value
            : "Unknown Playwright error",
      value: typeof value.value === "string" ? value.value : undefined,
      stack: typeof value.stack === "string" ? value.stack : undefined
    }));
}

function normalizeAttachments(values: unknown[] | undefined): PlaywrightResultAttachmentV1[] {
  return (values ?? [])
    .filter(
      (
        value
      ): value is {
        name?: unknown;
        contentType?: unknown;
        path?: unknown;
      } => Boolean(value) && typeof value === "object" && typeof (value as { name?: unknown }).name === "string"
    )
    .map((value) => ({
      name: value.name as string,
      contentType: typeof value.contentType === "string" ? value.contentType : undefined,
      path: typeof value.path === "string" ? normalizeOutputPath(value.path) : undefined
    }))
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || (left.path ?? "").localeCompare(right.path ?? "")
    );
}

function normalizeStatus(status: string | undefined): PlaywrightTestResultV1["status"] {
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  if (status === "timedOut") return "timedOut";
  if (status === "skipped") return "skipped";
  return "interrupted";
}

function normalizeFilePath(filePath: string): string {
  const projectRoot = process.env.HARNESS_COMET_PLAYWRIGHT_PROJECT_ROOT;
  if (projectRoot && path.isAbsolute(filePath)) {
    return normalizePath(path.relative(projectRoot, filePath));
  }
  return normalizePath(filePath);
}

function normalizeOutputPath(filePath: string): string {
  return normalizeFilePath(filePath);
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

function compareEntries(left: PlaywrightTestResultV1, right: PlaywrightTestResultV1): number {
  return (
    left.file.localeCompare(right.file) ||
    left.title.localeCompare(right.title) ||
    (left.project ?? "").localeCompare(right.project ?? "")
  );
}
