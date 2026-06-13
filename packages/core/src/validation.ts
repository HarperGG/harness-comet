import type { LoadedHarnessConfig } from "./config.js";
import { discoverHarnessAssets, type DiscoveredAssets } from "./discovery.js";
import { loadAdapter } from "./adapter.js";
import { createGenericOracles } from "./oracles.js";
import { HarnessError } from "./errors.js";

export interface ValidationResult {
  ok: boolean;
  errors: HarnessError[];
  assets: DiscoveredAssets;
}

export async function validateHarnessProject(
  config: LoadedHarnessConfig,
  options: { staticOnly?: boolean; scenarioIds?: string[] } = {}
): Promise<ValidationResult> {
  const assets = await discoverHarnessAssets(config);
  const errors: HarnessError[] = [];
  const fixtureIds = new Set(assets.fixtures.map((fixture) => fixture.fixture.id));

  for (const asset of assets.scenarios) {
    if (options.scenarioIds?.length && !options.scenarioIds.includes(asset.scenario.id)) continue;
    for (const fixtureRef of asset.scenario.fixtureRefs ?? []) {
      if (!fixtureIds.has(fixtureRef)) {
        errors.push(
          new HarnessError({
            code: "FIXTURE_NOT_FOUND",
            category: "schema",
            message: `Fixture not found: ${fixtureRef}`,
            file: asset.file
          })
        );
      }
    }
  }

  if (!options.staticOnly) {
    for (const asset of assets.scenarios) {
      if (options.scenarioIds?.length && !options.scenarioIds.includes(asset.scenario.id)) continue;
      const adapterName = asset.scenario.adapter ?? config.config.adapter.default;
      try {
        const adapter = await loadAdapter(config, adapterName);
        const oracles = { ...createGenericOracles(), ...(adapter.oracles ?? {}) };
        for (const step of asset.scenario.steps) {
          if (!adapter.actions[step.action]) {
            errors.push(
              new HarnessError({
                code: "ACTION_NOT_FOUND",
                category: "schema",
                message: `Action not found: ${step.action}`,
                file: asset.file
              })
            );
          }
        }
        for (const assertion of asset.scenario.assertions) {
          if (!adapter.inspectors[assertion.inspect]) {
            errors.push(
              new HarnessError({
                code: "INSPECTOR_NOT_FOUND",
                category: "schema",
                message: `Inspector not found: ${assertion.inspect}`,
                file: asset.file
              })
            );
          }
          if (!oracles[assertion.oracle]) {
            errors.push(
              new HarnessError({
                code: "ORACLE_NOT_FOUND",
                category: "schema",
                message: `Oracle not found: ${assertion.oracle}`,
                file: asset.file
              })
            );
          }
        }
      } catch (error) {
        errors.push(
          error instanceof HarnessError
            ? error
            : new HarnessError({
                code: "VALIDATION_ERROR",
                category: "schema",
                message: String(error)
              })
        );
      }
    }
  }

  return { ok: errors.length === 0, errors, assets };
}
