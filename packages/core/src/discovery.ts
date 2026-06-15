import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import YAML from "yaml";
import * as harnessSchema from "@harness-comet/schema";
import type { FixtureMetadataV1, JsonValue, ScenarioV1 } from "@harness-comet/schema";
import type { LoadedHarnessConfig } from "./config.js";
import { resolveInsideRoot } from "./config.js";
import { HarnessError } from "./errors.js";

export interface ScenarioAsset {
  file: string;
  scenario: ScenarioV1;
}

export interface FixtureAsset {
  file: string;
  fixture: FixtureMetadataV1;
  data: JsonValue;
}

export interface DiscoveredAssets {
  scenarios: ScenarioAsset[];
  fixtures: FixtureAsset[];
}

export interface HarnessAssetAnalysisQuery {
  component?: string;
  capability?: string;
  behavior?: string;
  contract?: string;
}

export interface ScenarioAnalysisCandidate {
  id: string;
  file: string;
  score: number;
  reasons: string[];
  scenario: ScenarioV1;
}

export interface FixtureAnalysisCandidate {
  id: string;
  file: string;
  score: number;
  reasons: string[];
  fixture: FixtureMetadataV1;
}

export interface HarnessAssetAnalysisResult {
  query: HarnessAssetAnalysisQuery;
  scenarios: ScenarioAnalysisCandidate[];
  fixtures: FixtureAnalysisCandidate[];
}

export async function discoverHarnessAssets(
  config: LoadedHarnessConfig
): Promise<DiscoveredAssets> {
  const scenarioFiles = await fg(["**/*.scenario.yaml", "**/*.scenario.yml"], {
    cwd: config.paths.scenarios,
    absolute: true,
    onlyFiles: true
  });
  const fixtureFiles = await fg(["**/fixture.yaml", "**/fixture.yml"], {
    cwd: config.paths.fixtures,
    absolute: true,
    onlyFiles: true
  });

  const scenarios = await Promise.all([...scenarioFiles].sort().map((file) => loadScenario(file)));
  const fixtures = await Promise.all(
    [...fixtureFiles].sort().map((file) => loadFixture(config.projectRoot, file))
  );

  scenarios.sort((a, b) => a.scenario.id.localeCompare(b.scenario.id));
  fixtures.sort((a, b) => a.fixture.id.localeCompare(b.fixture.id));
  ensureUnique(
    scenarios.map((item) => item.scenario.id),
    "Scenario"
  );
  ensureUnique(
    fixtures.map((item) => item.fixture.id),
    "Fixture"
  );
  return { scenarios, fixtures };
}

export async function analyzeHarnessAssets(
  config: LoadedHarnessConfig,
  query: HarnessAssetAnalysisQuery
): Promise<HarnessAssetAnalysisResult> {
  const assets = await discoverHarnessAssets(config);
  const scenarios = assets.scenarios
    .map((asset) => toScenarioCandidate(asset, query))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const fixtures = assets.fixtures
    .map((asset) => toFixtureCandidate(asset, query, scenarios))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  return { query, scenarios, fixtures };
}

async function loadScenario(file: string): Promise<ScenarioAsset> {
  try {
    const schemaApi = await loadSchemaApi();
    const parsed = YAML.parse(await fs.readFile(file, "utf8"));
    return { file, scenario: schemaApi.ScenarioV1Schema.parse(parsed) };
  } catch (error) {
    throw new HarnessError({
      code: "SCENARIO_INVALID",
      category: "schema",
      message: error instanceof Error ? error.message : String(error),
      file
    });
  }
}

async function loadFixture(projectRoot: string, file: string): Promise<FixtureAsset> {
  try {
    const schemaApi = await loadSchemaApi();
    const fixture = schemaApi.FixtureMetadataV1Schema.parse(YAML.parse(await fs.readFile(file, "utf8")));
    const data =
      fixture.inline !== undefined
        ? fixture.inline
        : JSON.parse(
            await fs.readFile(
              resolveInsideRoot(
                projectRoot,
                path.join(path.dirname(path.relative(projectRoot, file)), fixture.dataFile!),
                "fixture data"
              ),
              "utf8"
            )
          );
    return { file, fixture, data };
  } catch (error) {
    throw new HarnessError({
      code: "FIXTURE_INVALID",
      category: "schema",
      message: error instanceof Error ? error.message : String(error),
      file
    });
  }
}

function ensureUnique(ids: string[], label: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new HarnessError({
        code: `${label.toUpperCase()}_DUPLICATE_ID`,
        category: "schema",
        message: `${label} id is duplicated: ${id}`
      });
    }
    seen.add(id);
  }
}

function toScenarioCandidate(
  asset: ScenarioAsset,
  query: HarnessAssetAnalysisQuery
): ScenarioAnalysisCandidate {
  const reasons: string[] = [];
  let score = 0;
  const business = asset.scenario.business;

  if (query.component && matches(query.component, business?.component)) {
    score += 4;
    reasons.push(`component=${business?.component}`);
  }
  if (query.capability && matches(query.capability, business?.capability)) {
    score += 4;
    reasons.push(`capability=${business?.capability}`);
  }
  if (query.behavior && matches(query.behavior, business?.behavior)) {
    score += 4;
    reasons.push(`behavior=${business?.behavior}`);
  }
  if (query.contract && matches(query.contract, business?.contract)) {
    score += 5;
    reasons.push(`contract=${business?.contract}`);
  }

  const fallbackHaystack = [
    asset.scenario.id,
    asset.scenario.title,
    ...(asset.scenario.tags ?? [])
  ].join(" ");
  for (const token of compactQueryTerms(query)) {
    if (score === 0 && fallbackHaystack.toLowerCase().includes(token.toLowerCase())) {
      score += 1;
      reasons.push(`text=${token}`);
    }
  }

  return { id: asset.scenario.id, file: asset.file, score, reasons, scenario: asset.scenario };
}

function toFixtureCandidate(
  asset: FixtureAsset,
  query: HarnessAssetAnalysisQuery,
  scenarios: ScenarioAnalysisCandidate[]
): FixtureAnalysisCandidate {
  const reasons: string[] = [];
  let score = 0;
  const business = asset.fixture.business;

  if (query.contract && business?.consumers?.some((consumer) => matches(query.contract!, consumer))) {
    score += 4;
    reasons.push(`consumer=${query.contract}`);
  }

  const inferredContracts = scenarios
    .map((scenario) => scenario.scenario.business?.contract)
    .filter((value): value is string => Boolean(value));
  for (const contract of inferredContracts) {
    if (business?.consumers?.some((consumer) => matches(contract, consumer))) {
      score += 3;
      reasons.push(`consumer=${contract}`);
    }
  }

  if (query.component && matches(query.component, business?.purpose)) {
    score += 2;
    reasons.push(`purpose=${business?.purpose}`);
  }
  if (query.capability && matches(query.capability, business?.purpose)) {
    score += 2;
    reasons.push(`purpose=${business?.purpose}`);
  }
  if (query.behavior && matches(query.behavior, business?.purpose)) {
    score += 2;
    reasons.push(`purpose=${business?.purpose}`);
  }

  return { id: asset.fixture.id, file: asset.file, score, reasons, fixture: asset.fixture };
}

function matches(query: string, candidate: string | undefined): boolean {
  if (!candidate) return false;
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCandidate = candidate.trim().toLowerCase();
  return normalizedQuery === normalizedCandidate || normalizedCandidate.includes(normalizedQuery);
}

function compactQueryTerms(query: HarnessAssetAnalysisQuery): string[] {
  return [query.component, query.capability, query.behavior, query.contract].filter(
    (value): value is string => Boolean(value?.trim())
  );
}

async function loadSchemaApi(): Promise<typeof import("@harness-comet/schema")> {
  if ("ScenarioBusinessV1Schema" in harnessSchema && "FixtureBusinessV1Schema" in harnessSchema) {
    return harnessSchema;
  }
  const sourceModuleUrl = new URL("../../schema/src/index.ts", import.meta.url);
  return await import(sourceModuleUrl.href);
}
