import fs from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import {
  HarnessError,
  discoverHarnessAssets,
  listPlaywrightTests,
  loadHarnessCometConfig,
  loadHarnessConfig,
  mapErrorToExitCode,
  runPlaywrightHarness,
  runHarness,
  validatePlaywrightHarnessProject,
  validateHarnessProject
} from "@hapergg/harness-comet-core";
import { registerCometCommands } from "./commands/comet.js";
import { registerImpactCommands } from "./commands/impact.js";
import { createPlaywrightIncident } from "./commands/create.js";
import { initHarnessProject, scenarioTemplate } from "./commands/init.js";

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
  const { commandArgv, passthroughArgs } = splitArgv(argv);
  const program = buildProgram({ playwrightPassthroughArgs: passthroughArgs });
  await program.parseAsync(commandArgv);
}

export function buildProgram(options: { playwrightPassthroughArgs?: string[] } = {}): Command {
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
    .option("--mode <runtime|playwright>", "project mode", "runtime")
    .option("--adapter <memory|playwright|custom>", "adapter template", "memory")
    .option("--test-dir <path>", "Playwright test directory", "tests")
    .option("--skip-install", "write Playwright project files without running dependency install")
    .option("--skip-browsers", "skip Playwright browser installation")
    .option("--yes", "accept defaults")
    .option("--force", "create missing files even when some exist")
    .option("--overwrite-config", "overwrite harness-comet.config.ts")
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

  const tests = program.command("tests");
  tests
    .command("list")
    .option("--tag <tag>", "filter by tag")
    .action(withErrors(program, async (commandOptions) => testsListCommand(rootOptions(program), commandOptions)));

  const create = program.command("create");
  create
    .command("incident")
    .argument("<id>")
    .option("--title <text>", "incident title")
    .option("--issue-url <url>", "linked issue URL")
    .option("--force", "overwrite generated incident files when safe")
    .action(
      withErrors(program, async (id, commandOptions) =>
        createIncidentCommand(rootOptions(program), id, commandOptions)
      )
    );

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

  const projectGuidance = program
    .command("project-guidance")
    .description("Project knowledge files and Agent entry wiring");
  projectGuidance
    .command("init")
    .description("Initialize .agents rules/structure files and wire supported Agent entries")
    .action(withErrors(program, async () => projectGuidanceInitCommand(rootOptions(program))));

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
    .action(
      withErrors(program, async (commandOptions) =>
        runCommand(rootOptions(program), commandOptions, options.playwrightPassthroughArgs ?? [])
      )
    );

  registerCometCommands(
    program,
    (action) => withErrors(program, action),
    () => rootOptions(program)
  );
  registerImpactCommands(
    program,
    (action) => withErrors(program, action),
    () => rootOptions(program)
  );

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
  options: {
    mode: "runtime" | "playwright";
    adapter: string;
    testDir?: string;
    skipInstall?: boolean;
    skipBrowsers?: boolean;
    overwriteConfig?: boolean;
  }
): Promise<void> {
  const root = path.resolve(global.root ?? process.cwd());
  const result = await initHarnessProject({
    root,
    mode: options.mode,
    adapter: options.adapter,
    testDir: options.testDir,
    install: options.skipInstall ? false : true,
    installBrowsers: options.skipBrowsers ? false : true,
    overwriteConfig: options.overwriteConfig,
    includeHarnessComet: options.mode === "playwright" ? false : undefined
  });

  output(
    global,
    result,
    options.mode === "playwright" ? "Initialized Playwright assets" : "Initialized harness assets"
  );
}

async function validateCommand(
  global: GlobalOptions,
  options: { scenario?: string; staticOnly?: boolean }
): Promise<void> {
  const project = await loadHarnessCometConfig({ root: global.root, config: global.config });
  if (project.config.mode === "playwright") {
    const result = await validatePlaywrightHarnessProject({
      root: project.root,
      playwright: project.config.playwright,
      incidents: project.config.incidents
    });
    if (!result.ok) throw result.errors[0];
    output(
      global,
      {
        ok: true,
        mode: "playwright",
        tests: result.assets.tests.length,
        harnessTagged: result.assets.tests.filter((test) => test.tags.includes("@harness")).length,
        warnings: result.warnings.map((warning) => warning.code)
      },
      "Playwright harness assets are valid"
    );
    return;
  }

  const config = await loadHarnessConfig({ root: global.root, config: global.config });
  const result = await validateHarnessProject(config, {
    scenarioIds: options.scenario ? [options.scenario] : undefined,
    staticOnly: options.staticOnly
  });
  if (!result.ok) throw result.errors[0];
  output(global, result, "Harness project is valid");
}

async function doctorCommand(global: GlobalOptions): Promise<void> {
  const config = await loadHarnessConfig({ root: global.root, config: global.config });
  const assets = await discoverHarnessAssets(config);
  output(global, assets, "Harness project discovery complete");
}

async function testsListCommand(global: GlobalOptions, options: { tag?: string }): Promise<void> {
  const project = await loadHarnessCometConfig({ root: global.root, config: global.config });
  if (project.config.mode !== "playwright") {
    throw new HarnessError({
      code: "INVALID_MODE",
      category: "selection",
      message: "tests list is only available in playwright mode"
    });
  }
  const tests = await listPlaywrightTests({
    root: project.root,
    configFile: project.config.playwright.configFile
  });
  output(
    global,
    { ok: true, tests: options.tag ? tests.filter((test) => test.tags.includes(options.tag!)) : tests },
    "Playwright tests discovered"
  );
}

async function createIncidentCommand(
  global: GlobalOptions,
  id: string,
  options: { title?: string; issueUrl?: string; force?: boolean }
): Promise<void> {
  const project = await loadHarnessCometConfig({ root: global.root, config: global.config });
  if (project.config.mode !== "playwright") {
    throw new HarnessError({
      code: "INVALID_MODE",
      category: "selection",
      message: "create incident is only available in playwright mode"
    });
  }
  const result = await createPlaywrightIncident({
    root: project.root,
    testDir: project.config.playwright.testDir,
    id,
    title: options.title,
    issueUrl: options.issueUrl,
    force: options.force
  });
  output(global, result, `Created incident scaffold ${id}`);
}

async function runCommand(
  global: GlobalOptions,
  options: {
    scenario?: string[];
    tag?: string[];
    all?: boolean;
    adapter?: string;
    workers?: number;
    timeout?: number;
    failFast?: boolean;
    dryRun?: boolean;
    headed?: boolean;
  },
  playwrightPassthroughArgs: string[]
): Promise<void> {
  const project = await loadHarnessCometConfig({ root: global.root, config: global.config });
  if (project.config.mode === "playwright") {
    const exitCode = await runPlaywrightHarness({
      root: project.root,
      configFile: project.config.playwright.configFile,
      args: [...(options.headed ? ["--headed"] : []), ...playwrightPassthroughArgs]
    });
    output(global, { ok: exitCode === 0, exitCode }, "Playwright run complete");
    if (exitCode !== 0) process.exitCode = exitCode;
    return;
  }

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
  output(global, result, "Harness run complete");
  if ("status" in result && result.status === "failed") process.exitCode = 1;
}

async function scenarioListCommand(global: GlobalOptions): Promise<void> {
  const config = await loadHarnessConfig({ root: global.root, config: global.config });
  const assets = await discoverHarnessAssets(config);
  output(global, { ok: true, scenarios: assets.scenarios }, "Scenarios discovered");
}

async function scenarioCreateCommand(
  global: GlobalOptions,
  id: string,
  options: { adapter?: string }
): Promise<void> {
  const config = await loadHarnessConfig({ root: global.root, config: global.config });
  const scenarioPath = path.join(config.paths.scenarios, `${id}.scenario.yaml`);
  await fs.mkdir(path.dirname(scenarioPath), { recursive: true });
  await fs.writeFile(scenarioPath, scenarioTemplate(options.adapter ?? "memory"), "utf8");
  output(global, { ok: true, created: [scenarioPath] }, `Created scenario ${id}`);
}

async function scenarioExplainCommand(global: GlobalOptions, id: string): Promise<void> {
  const config = await loadHarnessConfig({ root: global.root, config: global.config });
  const assets = await discoverHarnessAssets(config);
  const scenario = assets.scenarios.find((candidate) => candidate.scenario.id === id);
  if (!scenario) {
    throw new HarnessError({
      code: "SCENARIO_NOT_FOUND",
      category: "selection",
      message: `Scenario not found: ${id}`
    });
  }
  output(global, { ok: true, scenario }, `Scenario ${id}`);
}

async function projectGuidanceInitCommand(global: GlobalOptions): Promise<void> {
  const root = path.resolve(global.root ?? process.cwd());
  const adapter = await loadCometAdapterForProjectGuidance();
  await adapter.initializeProjectGuidance(root);
  output(global, { ok: true }, "Initialized project guidance");
}

async function loadCometAdapterForProjectGuidance(): Promise<
  Pick<typeof import("@hapergg/harness-comet-comet-adapter"), "initializeProjectGuidance">
> {
  const sourceModuleUrl = new URL("../../comet-adapter/src/index.ts", import.meta.url);
  if (import.meta.url.includes("/packages/cli/src/")) {
    return await import(sourceModuleUrl.href);
  }

  try {
    const adapter = await import("@hapergg/harness-comet-comet-adapter");
    if ("initializeProjectGuidance" in adapter) return adapter;
  } catch {
    // Fall back to the local source module in dev/test flows where the workspace package
    // export may still point at stale build artifacts.
  }
  return await import(sourceModuleUrl.href);
}

function output(global: GlobalOptions, value: unknown, message: string): void {
  if (global.json) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${pc.green("ok")} ${message}\n`);
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof HarnessError) {
    return { ...error.toJSON() };
  }
  return {
    code: "UNKNOWN",
    message: error instanceof Error ? error.message : String(error)
  };
}

export function splitArgv(argv: string[]): { commandArgv: string[]; passthroughArgs: string[] } {
  const separatorIndex = argv.indexOf("--");
  if (separatorIndex === -1) return { commandArgv: argv, passthroughArgs: [] };
  return {
    commandArgv: argv.slice(0, separatorIndex),
    passthroughArgs: argv.slice(separatorIndex + 1)
  };
}
