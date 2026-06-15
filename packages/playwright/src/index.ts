export type HarnessScenarioKind = "smoke" | "journey" | "regression" | "contract";
export type HarnessScenarioRisk = "low" | "medium" | "high";

export interface HarnessScenarioMetadata {
  id: string;
  title: string;
  component: string;
  capability: string;
  behavior: string;
  contract: string;
  kind?: HarnessScenarioKind;
  risk?: HarnessScenarioRisk;
  tags?: string[];
  linkedIssue?: string;
}

const scenarioKinds = new Set<HarnessScenarioKind>(["smoke", "journey", "regression", "contract"]);
const scenarioRisks = new Set<HarnessScenarioRisk>(["low", "medium", "high"]);

export function defineHarnessScenario(input: HarnessScenarioMetadata): HarnessScenarioMetadata {
  assertId(input.id, "id");
  assertNonEmpty(input.title, "title");
  assertNonEmpty(input.component, "component");
  assertNonEmpty(input.capability, "capability");
  assertNonEmpty(input.behavior, "behavior");
  assertNonEmpty(input.contract, "contract");

  if (input.kind && !scenarioKinds.has(input.kind)) {
    throw new Error(`Invalid kind: ${input.kind}`);
  }
  if (input.risk && !scenarioRisks.has(input.risk)) {
    throw new Error(`Invalid risk: ${input.risk}`);
  }
  if (input.tags && !Array.isArray(input.tags)) {
    throw new Error("tags must be an array");
  }

  return {
    ...input,
    kind: input.kind ?? "journey",
    risk: input.risk ?? "medium",
    tags: input.tags ?? []
  };
}

export function harnessAnnotation(
  scenario: HarnessScenarioMetadata
): { type: string; description: string } {
  return {
    type: "harness-scenario",
    description: scenario.id
  };
}

export { default as HarnessCometListReporter } from "./list-reporter.js";
export { default as HarnessCometReporter } from "./reporter.js";

function assertNonEmpty(value: string, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} is required`);
  }
}

function assertId(value: string, field: string): void {
  assertNonEmpty(value, field);
  if (value.length < 3 || value.length > 80 || !/^[a-z0-9-]+$/.test(value)) {
    throw new Error(`${field} must use lowercase letters, numbers, and dashes`);
  }
}
