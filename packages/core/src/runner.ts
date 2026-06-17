import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  AssertionRunResultV1,
  JsonValue,
  RunResultV1,
  ScenarioRunResultV1,
  ScenarioV1
} from "@hapergg/harness-comet-schema";
import type { HarnessAdapter, RunContext } from "@hapergg/harness-comet-sdk";
import type { LoadedHarnessConfig } from "./config.js";
import { loadHarnessConfig } from "./config.js";
import {
  discoverHarnessAssets,
  type DiscoveredAssets,
  type FixtureAsset,
  type ScenarioAsset
} from "./discovery.js";
import { loadAdapter } from "./adapter.js";
import { validateHarnessProject } from "./validation.js";
import { createGenericOracles } from "./oracles.js";
import { createLogger, silentLogger } from "./logger.js";
import { HarnessError, toHarnessError } from "./errors.js";

export interface RunHarnessOptions {
  root?: string;
  config?: string;
  scenarioIds?: string[];
  tags?: string[];
  all?: boolean;
  adapter?: string;
  workers?: number;
  timeoutMs?: number;
  failFast?: boolean;
  dryRun?: boolean;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  signal?: AbortSignal;
}

export interface DryRunResult {
  dryRun: true;
  scenarios: {
    id: string;
    adapter: string;
    fixtures: string[];
    actions: string[];
    inspectors: string[];
    oracles: string[];
  }[];
}

export async function runHarness(
  options: RunHarnessOptions = {}
): Promise<RunResultV1 | DryRunResult> {
  const config = await loadHarnessConfig({ root: options.root, config: options.config });
  const assets = await discoverHarnessAssets(config);
  const selected = selectScenarios(assets, options);
  if (options.dryRun) {
    return {
      dryRun: true,
      scenarios: selected.map(({ scenario }) => ({
        id: scenario.id,
        adapter: options.adapter ?? scenario.adapter ?? config.config.adapter.default,
        fixtures: scenario.fixtureRefs ?? [],
        actions: scenario.steps.map((step) => step.action),
        inspectors: scenario.assertions.map((assertion) => assertion.inspect),
        oracles: scenario.assertions.map((assertion) => assertion.oracle)
      }))
    };
  }
  const validation = await validateHarnessProject(config, {
    scenarioIds: selected.map((asset) => asset.scenario.id)
  });
  if (!validation.ok) throw validation.errors[0];

  const started = new Date();
  const runId = crypto.randomUUID();
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const logger = options.json
    ? silentLogger
    : createLogger({ quiet: options.quiet, verbose: options.verbose });

  const results: ScenarioRunResultV1[] = [];
  for (const asset of selected) {
    if (controller.signal.aborted) {
      results.push(cancelledScenario(asset.scenario));
      continue;
    }
    const result = await runScenario({
      runId,
      config,
      assets,
      asset,
      adapterName: options.adapter ?? asset.scenario.adapter ?? config.config.adapter.default,
      signal: controller.signal,
      logger
    });
    results.push(result);
    if ((options.failFast ?? config.config.runtime?.failFast) && result.status !== "passed") break;
  }

  options.signal?.removeEventListener("abort", abort);
  const completed = new Date();
  return summarize(runId, started, completed, results);
}

export function selectScenarios(
  assets: DiscoveredAssets,
  options: RunHarnessOptions
): ScenarioAsset[] {
  let selected: ScenarioAsset[];
  if (options.scenarioIds?.length) {
    const ids = new Set(options.scenarioIds);
    selected = assets.scenarios.filter((asset) => ids.has(asset.scenario.id));
    const found = new Set(selected.map((asset) => asset.scenario.id));
    const missing = [...ids].filter((id) => !found.has(id));
    if (missing.length) {
      throw new HarnessError({
        code: "SCENARIO_NOT_FOUND",
        category: "selection",
        message: `Scenario not found: ${missing.join(", ")}`
      });
    }
  } else if (options.tags?.length) {
    const tags = new Set(options.tags);
    selected = assets.scenarios.filter((asset) =>
      asset.scenario.tags?.some((tag) => tags.has(tag))
    );
  } else if (options.all) {
    selected = assets.scenarios;
  } else {
    throw new HarnessError({
      code: "SCENARIO_SELECTION_REQUIRED",
      category: "selection",
      message: "Select scenarios with --scenario, --tag, or --all"
    });
  }
  if (selected.length === 0) {
    throw new HarnessError({
      code: "SCENARIO_SELECTION_EMPTY",
      category: "selection",
      message: "No scenarios matched selection"
    });
  }
  return selected;
}

async function runScenario(args: {
  runId: string;
  config: LoadedHarnessConfig;
  assets: DiscoveredAssets;
  asset: ScenarioAsset;
  adapterName: string;
  signal: AbortSignal;
  logger: RunContext["logger"];
}): Promise<ScenarioRunResultV1> {
  const started = new Date();
  const scenario = args.asset.scenario;
  const steps: ScenarioRunResultV1["steps"] = [];
  const assertions: AssertionRunResultV1[] = [];
  const errors: ScenarioRunResultV1["errors"] = [];
  let status: ScenarioRunResultV1["status"] = "passed";
  let adapter: HarnessAdapter | undefined;
  let setupStarted = false;

  const fixtures = loadFixtureMap(args.assets.fixtures, scenario.fixtureRefs ?? []);
  const context: RunContext = {
    runId: args.runId,
    projectRoot: args.config.projectRoot,
    scenario,
    fixtures,
    values: new Map(),
    signal: args.signal,
    logger: args.logger
  };

  try {
    adapter = await loadAdapter(args.config, args.adapterName);
    setupStarted = true;
    await adapter.setup?.(context);
    for (const [index, step] of scenario.steps.entries()) {
      const stepStarted = Date.now();
      const id = step.id ?? `step-${String(index + 1).padStart(3, "0")}`;
      try {
        const action = adapter.actions[step.action];
        if (!action)
          throw new HarnessError({
            code: "ACTION_NOT_FOUND",
            category: "schema",
            message: `Action not found: ${step.action}`
          });
        const actionResult = await action.execute(step.input ?? null, context);
        if (actionResult.value !== undefined) context.values.set(id, actionResult.value);
        for (const [key, value] of Object.entries(actionResult.values ?? {}))
          context.values.set(key, value);
        steps.push({
          id,
          action: step.action,
          status: "passed",
          durationMs: Date.now() - stepStarted
        });
      } catch (error) {
        const mapped = toHarnessError(error, "action", "ACTION_ERROR");
        steps.push({
          id,
          action: step.action,
          status: "failed",
          durationMs: Date.now() - stepStarted,
          error: mapped.toJSON()
        });
        errors.push(mapped.toJSON());
        status = "error";
        if (!step.continueOnError) break;
      }
    }

    if (status !== "error") {
      for (const [index, assertion] of scenario.assertions.entries()) {
        const assertionStarted = Date.now();
        const id = assertion.id ?? `assertion-${String(index + 1).padStart(3, "0")}`;
        const blocking = assertion.blocking ?? true;
        try {
          const inspector = adapter.inspectors[assertion.inspect];
          if (!inspector)
            throw new HarnessError({
              code: "INSPECTOR_NOT_FOUND",
              category: "schema",
              message: `Inspector not found: ${assertion.inspect}`
            });
          const oracle = { ...createGenericOracles(), ...(adapter.oracles ?? {}) }[
            assertion.oracle
          ];
          if (!oracle)
            throw new HarnessError({
              code: "ORACLE_NOT_FOUND",
              category: "schema",
              message: `Oracle not found: ${assertion.oracle}`
            });
          const actual = await inspector.inspect(assertion.input ?? null, context);
          const expected = await resolveExpected(
            args.config,
            assertion.expected,
            assertion.expectedRef
          );
          const result = await oracle.evaluate({
            actual,
            expected,
            input: assertion.input,
            context
          });
          assertions.push({
            id,
            inspect: assertion.inspect,
            oracle: assertion.oracle,
            status: result.passed ? "passed" : "failed",
            blocking,
            durationMs: Date.now() - assertionStarted,
            actual,
            expected,
            differences: result.differences,
            message: result.message
          });
          if (!result.passed && blocking) status = "failed";
        } catch (error) {
          const mapped = toHarnessError(error, "oracle", "ASSERTION_ERROR");
          assertions.push({
            id,
            inspect: assertion.inspect,
            oracle: assertion.oracle,
            status: "error",
            blocking,
            durationMs: Date.now() - assertionStarted,
            error: mapped.toJSON()
          });
          errors.push(mapped.toJSON());
          status = "error";
        }
      }
    }
  } catch (error) {
    const mapped = toHarnessError(error, "adapter", "SCENARIO_ERROR");
    errors.push(mapped.toJSON());
    status = mapped.category === "environment" || mapped.category === "adapter" ? "error" : status;
  } finally {
    if (adapter && setupStarted) {
      try {
        await adapter.teardown?.(context);
      } catch (error) {
        const mapped = toHarnessError(error, "adapter", "TEARDOWN_ERROR");
        errors.push(mapped.toJSON());
        if (status === "passed") status = "error";
      }
    }
  }

  const completed = new Date();
  return {
    id: scenario.id,
    title: scenario.title,
    status,
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    durationMs: completed.getTime() - started.getTime(),
    steps,
    assertions,
    errors: errors.length ? errors : undefined
  };
}

function loadFixtureMap(fixtures: FixtureAsset[], refs: string[]): ReadonlyMap<string, JsonValue> {
  const byId = new Map(fixtures.map((fixture) => [fixture.fixture.id, fixture.data] as const));
  return new Map(refs.map((ref) => [ref, byId.get(ref) ?? null]));
}

async function resolveExpected(
  config: LoadedHarnessConfig,
  expected: JsonValue | undefined,
  expectedRef: string | undefined
): Promise<JsonValue> {
  if (expected !== undefined) return expected;
  if (!expectedRef) return null;
  const full = path.resolve(config.projectRoot, expectedRef);
  const relative = path.relative(config.projectRoot, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HarnessError({
      code: "EXPECTED_REF_OUTSIDE_ROOT",
      category: "schema",
      message: "expectedRef must stay inside project root"
    });
  }
  return JSON.parse(await fs.readFile(full, "utf8")) as JsonValue;
}

function cancelledScenario(scenario: ScenarioV1): ScenarioRunResultV1 {
  const now = new Date().toISOString();
  return {
    id: scenario.id,
    title: scenario.title,
    status: "cancelled",
    startedAt: now,
    completedAt: now,
    durationMs: 0,
    steps: [],
    assertions: []
  };
}

function summarize(
  runId: string,
  started: Date,
  completed: Date,
  scenarios: ScenarioRunResultV1[]
): RunResultV1 {
  const summary = {
    total: scenarios.length,
    passed: scenarios.filter((item) => item.status === "passed").length,
    failed: scenarios.filter((item) => item.status === "failed").length,
    error: scenarios.filter((item) => item.status === "error").length,
    cancelled: scenarios.filter((item) => item.status === "cancelled").length
  };
  const status: RunResultV1["status"] =
    summary.cancelled > 0
      ? "cancelled"
      : summary.error > 0
        ? "error"
        : summary.failed > 0
          ? "failed"
          : "passed";
  return {
    schemaVersion: 1,
    runId,
    status,
    startedAt: started.toISOString(),
    completedAt: completed.toISOString(),
    durationMs: completed.getTime() - started.getTime(),
    scenarios,
    summary
  };
}
