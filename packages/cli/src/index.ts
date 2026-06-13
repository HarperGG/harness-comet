import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import {
  HarnessError,
  discoverHarnessAssets,
  loadHarnessConfig,
  mapErrorToExitCode,
  runHarness,
  validateHarnessProject,
  type DryRunResult
} from "@harness-comet/core";

interface GlobalOptions {
  root?: string;
  config?: string;
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  color?: boolean;
}

export async function main(argv = process.argv): Promise<void> {
  if (Number(process.versions.node.split(".")[0]) < 20) {
    process.stderr.write("Node.js >=20 is required\n");
    process.exitCode = 3;
    return;
  }
  const program = buildProgram();
  await program.parseAsync(argv);
}

export function buildProgram(): Command {
  const program = new Command();
  program
    .name("harness-comet")
    .description("Independent Harness Runtime for scenario validation")
    .version("0.1.0")
    .option("--root <path>", "project root")
    .option("--config <path>", "config path")
    .option("--json", "write machine-readable JSON to stdout")
    .option("--quiet", "suppress non-error logs")
    .option("--verbose", "show verbose errors")
    .option("--no-color", "disable color");

  program
    .command("init")
    .option("--adapter <memory|playwright|custom>", "adapter template", "memory")
    .option("--yes", "accept defaults")
    .option("--force", "create missing files even when some exist")
    .option("--overwrite-config", "overwrite harness.config.ts")
    .action(withErrors(program, async (options) => initCommand(rootOptions(program), options)));

  program
    .command("validate")
    .option("--scenario <id>", "scenario id")
    .option("--static-only", "skip adapter import")
    .option("--strict", "strict validation")
    .action(withErrors(program, async (options) => validateCommand(rootOptions(program), options)));

  program
    .command("doctor")
    .action(withErrors(program, async () => doctorCommand(rootOptions(program))));

  const scenario = program.command("scenario");
  scenario
    .command("list")
    .action(withErrors(program, async () => scenarioListCommand(rootOptions(program))));
  scenario
    .command("create")
    .argument("<id>")
    .option("--adapter <name>", "adapter name", "memory")
    .action(
      withErrors(program, async (id, options) =>
        scenarioCreateCommand(rootOptions(program), id, options)
      )
    );
  scenario
    .command("validate")
    .argument("<id>")
    .action(
      withErrors(program, async (id) => validateCommand(rootOptions(program), { scenario: id }))
    );
  scenario
    .command("explain")
    .argument("<id>")
    .action(withErrors(program, async (id) => scenarioExplainCommand(rootOptions(program), id)));

  program
    .command("run")
    .option("--scenario <id>", "scenario id", collect, [] as string[])
    .option("--tag <tag>", "tag", collect, [] as string[])
    .option("--all", "run all scenarios")
    .option("--adapter <name>", "override adapter")
    .option("--workers <n>", "worker count", parseInt)
    .option("--timeout <ms>", "timeout", parseInt)
    .option("--fail-fast", "stop after first failure")
    .option("--headed", "run browser headed")
    .option("--dry-run", "show selected scenarios without execution")
    .action(withErrors(program, async (options) => runCommand(rootOptions(program), options)));

  program
    .command("comet")
    .description("Optional Comet integration commands")
    .action(() => {
      process.stderr.write("Comet integration is not implemented in Part A\n");
      process.exitCode = 6;
    });

  return program;
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

function rootOptions(program: Command): GlobalOptions {
  return program.opts<GlobalOptions>();
}

function withErrors(program: Command, action: (...args: any[]) => Promise<void>) {
  return async (...args: any[]) => {
    const options = rootOptions(program);
    try {
      await action(...args);
    } catch (error) {
      const exitCode = mapErrorToExitCode(error);
      process.exitCode = exitCode;
      if (options.json) {
        process.stdout.write(
          `${JSON.stringify({ ok: false, error: serializeError(error), exitCode })}\n`
        );
      } else {
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${pc.red("error")} ${message}\n`);
        if (options.verbose && error instanceof Error && error.stack)
          process.stderr.write(`${error.stack}\n`);
      }
    }
  };
}

async function initCommand(
  global: GlobalOptions,
  options: { adapter: string; overwriteConfig?: boolean }
): Promise<void> {
  const root = path.resolve(global.root ?? process.cwd());
  await fs.mkdir(path.join(root, "harness", "scenarios"), { recursive: true });
  await fs.mkdir(path.join(root, "harness", "fixtures", "example-empty"), { recursive: true });
  await fs.mkdir(path.join(root, "harness", "adapters"), { recursive: true });
  await fs.mkdir(path.join(root, "harness", "oracles"), { recursive: true });

  await writeFileSafe(
    path.join(root, "harness.config.ts"),
    configTemplate(options.adapter),
    Boolean(options.overwriteConfig)
  );
  await writeFileSafe(
    path.join(root, "harness", "fixtures", "example-empty", "fixture.yaml"),
    "schemaVersion: 1\nid: example-empty\ninline: {}\nsource: synthetic\ncontainsSensitiveData: false\n",
    false
  );
  await writeFileSafe(
    path.join(root, "harness", "scenarios", "example-smoke.scenario.yaml"),
    scenarioTemplate(options.adapter),
    false
  );

  output(
    global,
    { ok: true, created: ["harness.config.ts", "harness/"] },
    "Initialized harness assets"
  );
}

function configTemplate(adapter: string): string {
  const defaultAdapter = adapter === "playwright" ? "playwright" : "memory";
  const entry =
    defaultAdapter === "playwright"
      ? "@harness-comet/adapter-playwright"
      : "@harness-comet/adapter-memory";
  return `export default {
  schemaVersion: 1,
  paths: {
    scenarios: "harness/scenarios",
    fixtures: "harness/fixtures",
    adapters: "harness/adapters",
    oracles: "harness/oracles"
  },
  adapter: {
    default: "${defaultAdapter}",
    entries: {
      ${defaultAdapter}: "${entry}"
    }
  },
  runtime: {
    scenarioTimeoutMs: 60000,
    stepTimeoutMs: 15000,
    assertionTimeoutMs: 10000,
    workers: 1,
    failFast: false
  }
};
`;
}

function scenarioTemplate(adapter: string): string {
  if (adapter === "playwright") {
    return `schemaVersion: 1
id: example-smoke
title: Example smoke
adapter: playwright
tags: [smoke]
fixtureRefs: [example-empty]
steps:
  - action: page.goto
    input:
      url: "data:text/html,<title>Harness</title><main data-testid='message'>Hello Harness</main>"
assertions:
  - inspect: page.text
    input:
      selector: "[data-testid=message]"
    oracle: value.contains
    expected: "Hello Harness"
`;
  }
  return `schemaVersion: 1
id: example-smoke
title: Example smoke
adapter: memory
tags: [smoke]
fixtureRefs: [example-empty]
steps:
  - action: memory.set
    input:
      key: message
      value: Hello Harness
assertions:
  - inspect: memory.get
    input:
      key: message
    oracle: value.equals
    expected: Hello Harness
`;
}

async function writeFileSafe(file: string, content: string, overwrite: boolean): Promise<void> {
  try {
    if (!overwrite) await fs.access(file);
  } catch {
    await fs.writeFile(file, content, "utf8");
    return;
  }
  if (overwrite) await fs.writeFile(file, content, "utf8");
}

async function validateCommand(
  global: GlobalOptions,
  options: { scenario?: string; staticOnly?: boolean }
): Promise<void> {
  const config = await loadHarnessConfig({ root: global.root, config: global.config });
  const result = await validateHarnessProject(config, {
    staticOnly: options.staticOnly,
    scenarioIds: options.scenario ? [options.scenario] : undefined
  });
  if (!result.ok) throw result.errors[0];
  output(
    global,
    {
      ok: true,
      scenarios: result.assets.scenarios.length,
      fixtures: result.assets.fixtures.length
    },
    "Harness assets are valid"
  );
}

async function doctorCommand(global: GlobalOptions): Promise<void> {
  const checks = [
    { name: "node", ok: Number(process.versions.node.split(".")[0]) >= 20, detail: process.version }
  ];
  try {
    const config = await loadHarnessConfig({ root: global.root, config: global.config });
    checks.push({ name: "config", ok: true, detail: config.configPath });
    const assets = await discoverHarnessAssets(config);
    if (
      usesPlaywright(
        config,
        assets.scenarios.map((item) => item.scenario.adapter)
      )
    ) {
      try {
        const { getPlaywrightBrowserDiagnostics } = await import(
          "@harness-comet/adapter-playwright"
        );
        const browser = config.config.playwright?.browser ?? "chromium";
        const diagnostics = await getPlaywrightBrowserDiagnostics(browser);
        checks.push({
          name: `playwright-browser:${diagnostics.browser}`,
          ok: diagnostics.installed,
          detail: diagnostics.installed
            ? diagnostics.executablePath
            : `${diagnostics.issues.join("; ")} (install with: ${diagnostics.installCommand})`
        });
      } catch (error) {
        checks.push({
          name: "playwright-browser",
          ok: false,
          detail: error instanceof Error ? error.message : String(error)
        });
      }
    }
  } catch (error) {
    checks.push({
      name: "config",
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    });
  }
  output(
    global,
    { ok: checks.every((check) => check.ok), checks },
    checks.map((check) => `${check.ok ? "PASS" : "FAIL"} ${check.name} ${check.detail}`).join("\n")
  );
}

function usesPlaywright(
  config: Awaited<ReturnType<typeof loadHarnessConfig>>,
  scenarioAdapters: Array<string | undefined>
): boolean {
  if (config.config.adapter.default === "playwright") return true;
  return scenarioAdapters.some((adapter) => adapter === "playwright");
}

async function scenarioListCommand(global: GlobalOptions): Promise<void> {
  const config = await loadHarnessConfig({ root: global.root, config: global.config });
  const assets = await discoverHarnessAssets(config);
  output(
    global,
    { scenarios: assets.scenarios.map(({ scenario }) => scenario) },
    assets.scenarios
      .map(
        ({ scenario }) =>
          `${scenario.id}\t${scenario.title}\t${scenario.adapter ?? config.config.adapter.default}\t${(scenario.tags ?? []).join(",")}`
      )
      .join("\n")
  );
}

async function scenarioCreateCommand(
  global: GlobalOptions,
  id: string,
  options: { adapter: string }
): Promise<void> {
  const config = await loadHarnessConfig({ root: global.root, config: global.config });
  const file = path.join(config.paths.scenarios, `${id}.scenario.yaml`);
  await writeFileSafe(file, scenarioTemplate(options.adapter).replace("example-smoke", id), false);
  output(global, { ok: true, file }, `Created ${file}`);
}

async function scenarioExplainCommand(global: GlobalOptions, id: string): Promise<void> {
  const config = await loadHarnessConfig({ root: global.root, config: global.config });
  const assets = await discoverHarnessAssets(config);
  const asset = assets.scenarios.find((item) => item.scenario.id === id);
  if (!asset)
    throw new HarnessError({
      code: "SCENARIO_NOT_FOUND",
      category: "selection",
      message: `Scenario not found: ${id}`
    });
  output(
    global,
    asset,
    [
      `Scenario: ${asset.scenario.id}`,
      `File: ${asset.file}`,
      `Fixtures: ${(asset.scenario.fixtureRefs ?? []).join(", ") || "-"}`,
      `Steps: ${asset.scenario.steps.map((step) => step.action).join(", ") || "-"}`,
      `Assertions: ${asset.scenario.assertions.map((assertion) => `${assertion.inspect} -> ${assertion.oracle}`).join(", ") || "-"}`,
      `Run: harness-comet run --scenario ${asset.scenario.id}`
    ].join("\n")
  );
}

async function runCommand(
  global: GlobalOptions,
  options: {
    scenario: string[];
    tag: string[];
    all?: boolean;
    adapter?: string;
    workers?: number;
    timeout?: number;
    failFast?: boolean;
    dryRun?: boolean;
  }
): Promise<void> {
  const result = await runHarness({
    root: global.root,
    config: global.config,
    scenarioIds: options.scenario,
    tags: options.tag,
    all: options.all,
    adapter: options.adapter,
    workers: options.workers,
    timeoutMs: options.timeout,
    failFast: options.failFast,
    dryRun: options.dryRun,
    json: global.json,
    quiet: global.quiet,
    verbose: global.verbose
  });
  if ("dryRun" in result) {
    output(global, result, formatDryRun(result));
    return;
  }
  process.exitCode = mapErrorToExitCode(result);
  output(global, result, formatRunResult(result));
}

function formatDryRun(result: DryRunResult): string {
  return result.scenarios
    .map(
      (scenario) =>
        `${scenario.id}: adapter=${scenario.adapter} fixtures=${scenario.fixtures.join(",") || "-"} actions=${scenario.actions.join(",")}`
    )
    .join("\n");
}

function formatRunResult(result: Awaited<ReturnType<typeof runHarness>>): string {
  if ("dryRun" in result) return formatDryRun(result);
  const lines = [
    "Scenario                  Status   Duration",
    "------------------------------------------------"
  ];
  for (const scenario of result.scenarios) {
    lines.push(
      `${scenario.id.padEnd(25)} ${scenario.status.toUpperCase().padEnd(8)} ${scenario.durationMs}ms`
    );
    for (const error of scenario.errors ?? []) {
      lines.push(`  ${error.code}: ${error.message}`);
    }
    for (const assertion of scenario.assertions) {
      if (assertion.status === "failed") {
        lines.push(`  ${assertion.id}: ${JSON.stringify(assertion.differences ?? [])}`);
      }
    }
  }
  lines.push(
    `${result.summary.passed} passed, ${result.summary.failed} failed, ${result.summary.error} error`
  );
  return lines.join("\n");
}

function output(global: GlobalOptions, json: unknown, text: string): void {
  process.stdout.write(`${global.json ? JSON.stringify(json, null, 2) : text}\n`);
}

function serializeError(error: unknown): unknown {
  if (error instanceof HarnessError) return error.toJSON();
  if (error instanceof Error) return { message: error.message };
  return { message: String(error) };
}
