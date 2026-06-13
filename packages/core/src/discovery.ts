import fs from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import YAML from "yaml";
import {
  FixtureMetadataV1Schema,
  ScenarioV1Schema,
  type FixtureMetadataV1,
  type JsonValue,
  type ScenarioV1
} from "@harness-comet/schema";
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

async function loadScenario(file: string): Promise<ScenarioAsset> {
  try {
    const parsed = YAML.parse(await fs.readFile(file, "utf8"));
    return { file, scenario: ScenarioV1Schema.parse(parsed) };
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
    const fixture = FixtureMetadataV1Schema.parse(YAML.parse(await fs.readFile(file, "utf8")));
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
