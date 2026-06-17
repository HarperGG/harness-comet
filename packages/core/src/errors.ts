import type { HarnessErrorShape, JsonValue, RunResultV1 } from "@hapergg/harness-comet-schema";

export type HarnessErrorCategory = HarnessErrorShape["category"];

export class HarnessError extends Error implements HarnessErrorShape {
  readonly code: string;
  readonly category: HarnessErrorCategory;
  readonly hint?: string;
  readonly file?: string;
  readonly path?: string;
  readonly context?: Record<string, JsonValue>;

  constructor(shape: HarnessErrorShape) {
    super(shape.message);
    this.name = "HarnessError";
    this.code = shape.code;
    this.category = shape.category;
    this.hint = shape.hint;
    this.file = shape.file;
    this.path = shape.path;
    this.context = shape.context;
  }

  toJSON(): HarnessErrorShape {
    return {
      code: this.code,
      category: this.category,
      message: this.message,
      hint: this.hint,
      file: this.file,
      path: this.path,
      context: this.context
    };
  }
}

export function toHarnessError(
  error: unknown,
  fallbackCategory: HarnessErrorCategory,
  fallbackCode: string
): HarnessError {
  if (error instanceof HarnessError) {
    return error;
  }
  return new HarnessError({
    code: fallbackCode,
    category: fallbackCategory,
    message: error instanceof Error ? error.message : String(error)
  });
}

export function mapErrorToExitCode(errorOrResult: unknown): number {
  if (isRunResult(errorOrResult)) {
    if (errorOrResult.status === "passed") return 0;
    if (errorOrResult.status === "failed") return 1;
    if (errorOrResult.status === "cancelled") return 7;
    const categories = errorOrResult.scenarios.flatMap(
      (scenario) => scenario.errors?.map((error) => error.category) ?? []
    );
    if (
      categories.some(
        (category) =>
          category === "environment" || category === "adapter" || category === "playwright"
      )
    )
      return 3;
    return 4;
  }

  const error = errorOrResult instanceof HarnessError ? errorOrResult : undefined;
  switch (error?.category) {
    case "config":
    case "schema":
    case "selection":
      return 2;
    case "environment":
    case "adapter":
    case "playwright":
      return 3;
    case "action":
    case "inspector":
    case "oracle":
      return 4;
    default:
      return 10;
  }
}

function isRunResult(value: unknown): value is RunResultV1 {
  return (
    typeof value === "object" && value !== null && "schemaVersion" in value && "summary" in value
  );
}
