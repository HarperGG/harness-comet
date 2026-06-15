import fs from "node:fs/promises";
import path from "node:path";

interface ReporterAnnotation {
  type: string;
  description?: string;
}

interface ReporterTestEntry {
  project?: string;
  file: string;
  title: string;
  tags: string[];
  annotations: ReporterAnnotation[];
}

export default class HarnessCometListReporter {
  async onBegin(_config: unknown, suite: any): Promise<void> {
    const outputFile = process.env.HARNESS_COMET_PLAYWRIGHT_LIST_OUTPUT_FILE;
    if (!outputFile) return;

    const tests = normalizeEntries((suite?.allTests?.() ?? []).map((test: any) => toEntry(test)));
    await fs.mkdir(path.dirname(outputFile), { recursive: true });
    const tempFile = `${outputFile}.tmp`;
    await fs.writeFile(tempFile, `${JSON.stringify(tests, null, 2)}\n`, "utf8");
    await fs.rename(tempFile, outputFile);
  }
}

function toEntry(test: any): ReporterTestEntry {
  return {
    project: readProjectName(test),
    file: normalizePath(readFile(test)),
    title: readTitle(test),
    tags: readTags(test),
    annotations: readAnnotations(test)
  };
}

function readProjectName(test: any): string | undefined {
  return test?.parent?.project?.()?.name ?? test?._projectName;
}

function readFile(test: any): string {
  return test?.location?.file ?? "";
}

function readTitle(test: any): string {
  if (typeof test?.titlePath === "function") {
    const parts = test.titlePath().filter((part: unknown) => typeof part === "string");
    return parts.at(-1) ?? test?.title ?? "";
  }
  return test?.title ?? "";
}

function readTags(test: any): string[] {
  if (Array.isArray(test?.tags)) {
    return test.tags.filter((tag: unknown): tag is string => typeof tag === "string");
  }
  return [];
}

function readAnnotations(test: any): ReporterAnnotation[] {
  if (!Array.isArray(test?.annotations)) return [];
  return test.annotations
    .filter(
      (annotation: unknown): annotation is ReporterAnnotation =>
        Boolean(annotation) &&
        typeof annotation === "object" &&
        typeof (annotation as ReporterAnnotation).type === "string"
    )
    .map((annotation: ReporterAnnotation) => ({
      type: annotation.type,
      description: annotation.description
    }));
}

function normalizeEntries(entries: ReporterTestEntry[]): ReporterTestEntry[] {
  return entries
    .map((entry) => ({
      ...entry,
      tags: [...new Set(entry.tags)].sort(),
      annotations: [...entry.annotations].sort(
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

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}
