import { HarnessError, mapErrorToExitCode } from "@hapergg/harness-comet-core";
import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { initHarnessProject } from "./init.js";
import type {
  CometArchiveCheckReport,
  CometBindReport,
  CometDiscoveryReport,
  CometDiffFileChange,
  CometDiffReport,
  CometHookReport,
  CometInstallFilePlan,
  CometInstallReport,
  CometCliStatus,
  CometUninstallReport,
  CometVerifyReport
} from "@hapergg/harness-comet-comet-adapter";
import type { Command } from "commander";

const execFileAsync = promisify(execFile);
const COMET_PACKAGE = "@rpamis/comet";
const COMET_INSTALL_COMMAND = `npm install -g ${COMET_PACKAGE}`;

interface GlobalOptions {
  root?: string;
  json?: boolean;
}

interface BrowserInstallSummary {
  requested: boolean;
  installed: boolean;
  command?: string;
  skippedReason?: string;
}

interface HarnessInitSummary {
  requested: boolean;
  initialized: boolean;
  adapter?: string;
  created: string[];
  skipped: string[];
  hint?: string;
  browsers?: BrowserInstallSummary;
}

export function registerCometCommands(
  program: Command,
  withErrors: (action: (...args: any[]) => Promise<void>) => (...args: any[]) => Promise<void>,
  getOptions: () => GlobalOptions
): void {
  const comet = program.command("comet").description("Optional Comet integration commands");
  const hook = comet.command("hook").description("Comet phase validators");
  hook
    .command("open")
    .requiredOption("--change <change>", "change id")
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const report = await runCometHook("open", options.root ?? process.cwd(), commandOptions.change);
        if (options.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatHookReport(report));
      })
    );
  hook
    .command("design")
    .requiredOption("--change <change>", "change id")
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const report = await runCometHook("design", options.root ?? process.cwd(), commandOptions.change);
        if (options.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatHookReport(report));
      })
    );
  hook
    .command("build")
    .requiredOption("--change <change>", "change id")
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const report = await runCometHook("build", options.root ?? process.cwd(), commandOptions.change);
        if (options.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatHookReport(report));
      })
    );
  comet
    .command("archive-check")
    .requiredOption("--change <change>", "change id")
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const report = await archiveCheckComet(options.root ?? process.cwd(), commandOptions.change);
        if (options.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatArchiveCheckReport(report));
      })
    );
  comet
    .command("bind")
    .requiredOption("--change <change>", "change id")
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const report = await bindComet(options.root ?? process.cwd(), commandOptions.change);
        if (options.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatBindReport(report));
      })
    );
  comet
    .command("verify")
    .requiredOption("--change <change>", "change id")
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const report = await verifyComet(options.root ?? process.cwd(), commandOptions.change);
        if (options.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatVerifyReport(report));
        process.exitCode =
          report.result === "passed" || report.result === "not-applicable"
            ? 0
            : report.result === "failed"
              ? 1
              : 4;
      })
    );
  comet
    .command("diff")
    .action(
      withErrors(async () => {
        const options = getOptions();
        const report = await diffComet(options.root ?? process.cwd());
        if (options.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatDiffReport(report));
        process.exitCode = report.comet.installed && report.comet.supported ? 0 : 6;
      })
    );
  comet
    .command("sync")
    .action(
      withErrors(async () => {
        const options = getOptions();
        const report = await syncComet(options.root ?? process.cwd());
        if (options.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatInstallReport(report));
        process.exitCode = report.comet.installed && report.comet.supported ? 0 : 6;
      })
    );
  comet
    .command("uninstall")
    .option("--platform <id>", "platform id", collect, [] as string[])
    .option("--unbind", "clear verify_command bindings managed by harness-comet when supported")
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const report = await uninstallComet(options.root ?? process.cwd(), commandOptions);
        if (options.json) {
          process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatUninstallReport(report));
        process.exitCode = report.comet.installed && report.comet.supported ? 0 : 6;
      })
    );
  comet
    .command("install")
    .option("--platform <id>", "platform id", collect, [] as string[])
    .option("--all-detected", "install for all detected project-local targets")
    .option("--yes", "accept non-interactive install defaults")
    .option("--init-harness", "initialize Harness assets after Comet install when missing")
    .option("--mode <runtime|playwright>", "Harness mode for --init-harness", "runtime")
    .option("--adapter <memory|playwright>", "Harness adapter template for --init-harness", "memory")
    .option("--test-dir <path>", "Playwright test directory for --mode playwright", "tests")
    .option("--skip-install", "write Harness files without running dependency install")
    .option("--skip-browsers", "skip Playwright browser installation")
    .option("--install-browsers", "install Playwright Chromium after initializing Harness")
    .option("--dry-run", "show the write plan without changing files")
    .option(
      "--force",
      "overwrite files already managed by harness-comet or files explicitly allowed by the installer"
    )
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const root = options.root ?? process.cwd();
        if (!options.json && !commandOptions.dryRun) {
          const shouldContinue = await ensureCometCliForInstall(root, commandOptions);
          if (!shouldContinue) return;
        }
        const report = await installComet(root, commandOptions);
        const harness = await maybeInitHarness(root, commandOptions);
        if (options.json) {
          process.stdout.write(`${JSON.stringify({ ...report, harness }, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatInstallReport(report, harness));
        process.exitCode = report.comet.installed && report.comet.supported ? 0 : 6;
      })
    );
  comet.command("doctor").action(
    withErrors(async () => {
      const options = getOptions();
      const report = await doctorComet(options.root ?? process.cwd());
      if (options.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
      }
      process.stdout.write(formatDiscoveryReport(report));
      process.exitCode = report.comet.installed && report.comet.supported ? 0 : 6;
    })
  );
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

async function doctorComet(projectRoot: string): Promise<CometDiscoveryReport> {
  try {
    const adapter = await loadCometAdapter();
    return await adapter.buildCometDiscoveryReport(projectRoot);
  } catch (error) {
    if (error instanceof HarnessError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const exitCode = mapErrorToExitCode(error);
    process.exitCode = exitCode === 10 ? 6 : exitCode;
    throw new Error(`Unable to load comet-adapter: ${message}`);
  }
}

async function installComet(
  projectRoot: string,
  commandOptions: {
    platform?: string[];
    allDetected?: boolean;
    yes?: boolean;
    initHarness?: boolean;
    mode?: "runtime" | "playwright";
    adapter?: string;
    installBrowsers?: boolean;
    dryRun?: boolean;
    force?: boolean;
  }
): Promise<CometInstallReport> {
  const adapter = await loadCometAdapter();
  return await adapter.installCometIntegration({
    projectRoot,
    platformIds: commandOptions.platform ?? [],
    allDetected: commandOptions.allDetected,
    yes: commandOptions.yes,
    dryRun: commandOptions.dryRun,
    force: commandOptions.force,
    projectMode: commandOptions.mode
  });
}

async function ensureCometCliForInstall(
  projectRoot: string,
  commandOptions: { yes?: boolean }
): Promise<boolean> {
  const adapter = await loadCometAdapter();
  const comet = await adapter.detectCometCli(projectRoot);
  if (comet.installed) return true;

  process.stdout.write(formatMissingCometPrompt(comet));
  if (!commandOptions.yes) {
    const confirmed = await confirmCometInstall();
    if (!confirmed) {
      process.stdout.write(formatCometInstallInstructions());
      process.exitCode = 6;
      return false;
    }
  }

  await installCometCli(projectRoot);
  const installed = await adapter.detectCometCli(projectRoot);
  if (!installed.installed) {
    throw new HarnessError({
      code: "COMET_CLI_INSTALL_FAILED",
      category: "environment",
      message: "Installed @rpamis/comet, but the Comet CLI is still not available",
      hint: `Run: ${COMET_INSTALL_COMMAND}`,
      context: {
        root: projectRoot,
        command: COMET_INSTALL_COMMAND,
        cause: installed.error ?? "Comet CLI was not found after installation"
      }
    });
  }
  return true;
}

function formatMissingCometPrompt(comet: CometCliStatus): string {
  return [
    "Comet CLI was not found.",
    "",
    "Harness-Comet requires:",
    "",
    `  ${COMET_PACKAGE} ${comet.supportedRange}`,
    "",
    "Install it globally now?",
    "",
    "  › Yes, run npm install -g @rpamis/comet",
    "",
    "    No, show installation instructions",
    ""
  ].join("\n");
}

async function confirmCometInstall(): Promise<boolean> {
  const input = await readStdinLine();
  if (!input.receivedInput) return false;
  const answer = input.value.trim().toLowerCase();
  return answer === "" || answer === "y" || answer === "yes" || answer === "1";
}

async function readStdinLine(): Promise<{ value: string; receivedInput: boolean }> {
  if (!process.stdin.readable || process.stdin.readableEnded) {
    return { value: "", receivedInput: false };
  }
  return await new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      if (!process.stdin.isTTY) process.stdin.pause();
    };
    const settle = (value: string, receivedInput: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve({ value, receivedInput });
    };
    const onData = (chunk: Buffer | string) => {
      const text = String(chunk);
      settle(text.split(/\r?\n/, 1)[0] ?? "", true);
    };
    const onEnd = () => settle("", false);
    process.stdin.once("data", onData);
    process.stdin.once("end", onEnd);
    process.stdin.resume();
  });
}

async function installCometCli(projectRoot: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["install", "-g", COMET_PACKAGE], {
      cwd: projectRoot,
      stdio: "inherit"
    });

    child.on("error", (error) => {
      reject(
        new HarnessError({
          code: "COMET_CLI_INSTALL_FAILED",
          category: "environment",
          message: "Unable to install @rpamis/comet",
          hint: `Run: ${COMET_INSTALL_COMMAND}`,
          context: {
            root: projectRoot,
            command: COMET_INSTALL_COMMAND,
            cause: error.message
          }
        })
      );
    });
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const cause = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
      reject(
        new HarnessError({
          code: "COMET_CLI_INSTALL_FAILED",
          category: "environment",
          message: "Unable to install @rpamis/comet",
          hint: `Run: ${COMET_INSTALL_COMMAND}`,
          context: {
            root: projectRoot,
            command: COMET_INSTALL_COMMAND,
            cause
          }
        })
      );
    });
  });
}

function formatCometInstallInstructions(): string {
  return [
    "",
    "Install Comet CLI with:",
    "",
    `  ${COMET_INSTALL_COMMAND}`,
    "",
    "Then re-run:",
    "",
    "  pnpm exec harness-comet comet install",
    ""
  ].join("\n");
}

async function maybeInitHarness(
  projectRoot: string,
  commandOptions: {
    initHarness?: boolean;
    mode?: "runtime" | "playwright";
    adapter?: string;
    testDir?: string;
    skipInstall?: boolean;
    skipBrowsers?: boolean;
    installBrowsers?: boolean;
    dryRun?: boolean;
  }
): Promise<HarnessInitSummary> {
  const configPath = path.join(projectRoot, "harness-comet.config.ts");
  const exists = await fileExists(configPath);
  const mode = commandOptions.mode ?? "runtime";
  const adapter = commandOptions.adapter ?? "memory";
  if (commandOptions.dryRun) {
    return {
      requested: Boolean(commandOptions.initHarness),
      initialized: false,
      adapter: commandOptions.initHarness ? adapter : undefined,
      created: [],
      skipped: [],
      hint: exists
        ? undefined
        : `Harness is not initialized. Run: harness-comet init --mode ${mode} --yes`,
      browsers: browserSummaryForSkippedInstall(commandOptions, adapter, "dry-run")
    };
  }
  if (commandOptions.initHarness) {
    if (exists) {
      return {
        requested: true,
        initialized: false,
        adapter,
        created: [],
        skipped: ["harness-comet.config.ts"],
        browsers: await maybeInstallBrowsers(projectRoot, commandOptions, adapter)
      };
    }
    const result = await initHarnessProject({
      root: projectRoot,
      mode,
      adapter,
      testDir: commandOptions.testDir,
      install: commandOptions.skipInstall ? false : true,
      installBrowsers: commandOptions.skipBrowsers
        ? false
        : commandOptions.installBrowsers !== false
    });
    return {
      requested: true,
      initialized: true,
      adapter,
      created: result.created,
      skipped: result.skipped,
      browsers: await maybeInstallBrowsers(projectRoot, commandOptions, adapter)
    };
  }
  return {
    requested: false,
    initialized: false,
    created: [],
    skipped: [],
    hint: exists ? undefined : `Harness is not initialized. Run: harness-comet init --mode ${mode} --yes`,
    browsers: browserSummaryForSkippedInstall(
      commandOptions,
      adapter,
      "--install-browsers requires --init-harness"
    )
  };
}

function browserSummaryForSkippedInstall(
  commandOptions: { installBrowsers?: boolean },
  adapter: string,
  reason: string
): BrowserInstallSummary | undefined {
  if (!commandOptions.installBrowsers) return undefined;
  if (adapter !== "playwright") {
    return {
      requested: true,
      installed: false,
      skippedReason: "--install-browsers requires --adapter playwright"
    };
  }
  return {
    requested: true,
    installed: false,
    skippedReason: reason
  };
}

async function maybeInstallBrowsers(
  projectRoot: string,
  commandOptions: { installBrowsers?: boolean },
  adapter: string
): Promise<BrowserInstallSummary | undefined> {
  if (!commandOptions.installBrowsers) return undefined;
  if (adapter !== "playwright") {
    return {
      requested: true,
      installed: false,
      skippedReason: "--install-browsers requires --adapter playwright"
    };
  }
  const command = await installPlaywrightBrowsers(projectRoot);
  return {
    requested: true,
    installed: true,
    command
  };
}

async function installPlaywrightBrowsers(projectRoot: string): Promise<string> {
  const override = process.env.HARNESS_COMET_PLAYWRIGHT_INSTALL_BIN;
  if (override) {
    await execFileAsync(override, [projectRoot], {
      cwd: projectRoot,
      maxBuffer: 10 * 1024 * 1024
    });
    return override;
  }

  const command = "pnpm";
  const args = [
    "--filter",
    "@hapergg/harness-comet-adapter-playwright",
    "exec",
    "playwright",
    "install",
    "chromium"
  ];
  await execFileAsync(command, args, {
    cwd: process.cwd(),
    maxBuffer: 50 * 1024 * 1024
  });
  return `${command} ${args.join(" ")}`;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function diffComet(projectRoot: string): Promise<CometDiffReport> {
  const adapter = await loadCometAdapter();
  return await adapter.diffCometIntegration(projectRoot);
}

async function bindComet(projectRoot: string, change: string): Promise<CometBindReport> {
  const adapter = await loadCometAdapter();
  return await adapter.bindCometVerifyCommand(projectRoot, change);
}

async function verifyComet(projectRoot: string, change: string): Promise<CometVerifyReport> {
  const adapter = await loadCometAdapter();
  return await adapter.verifyCometChange(projectRoot, change);
}

async function archiveCheckComet(
  projectRoot: string,
  change: string
): Promise<CometArchiveCheckReport> {
  const adapter = await loadCometAdapter();
  return await adapter.archiveCheckCometChange(projectRoot, change);
}

async function runCometHook(
  hook: "open" | "design" | "build",
  projectRoot: string,
  change: string
): Promise<CometHookReport> {
  const adapter = await loadCometAdapter();
  if (hook === "open") return await adapter.runCometOpenHook(projectRoot, change);
  if (hook === "design") return await adapter.runCometDesignHook(projectRoot, change);
  return await adapter.runCometBuildHook(projectRoot, change);
}

async function syncComet(projectRoot: string): Promise<CometInstallReport> {
  const adapter = await loadCometAdapter();
  return await adapter.syncCometIntegration(projectRoot);
}

async function uninstallComet(
  projectRoot: string,
  commandOptions: { platform?: string[]; unbind?: boolean }
): Promise<CometUninstallReport> {
  const adapter = await loadCometAdapter();
  return await adapter.uninstallCometIntegration({
    projectRoot,
    platformIds: commandOptions.platform ?? []
  });
}

function formatDiscoveryReport(report: CometDiscoveryReport): string {
  const lines = [
    `COMET installed=${report.comet.installed} supported=${report.comet.supported} version=${report.comet.version ?? "-"}`,
    `RANGE ${report.comet.supportedRange}`
  ];
  if (report.comet.error) lines.push(`ERROR ${report.comet.error}`);
  if (report.targets.length === 0) {
    lines.push("TARGETS 0");
  } else {
    for (const target of report.targets) {
      lines.push(`TARGET ${target.platformId} valid=${target.valid} skillRoot=${target.skillRoot}`);
      for (const issue of target.issues) {
        lines.push(`  ISSUE ${issue.code} ${issue.message}${issue.path ? ` (${issue.path})` : ""}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatInstallReport(report: CometInstallReport, harness?: HarnessInitSummary): string {
  const lines = [
    `COMET installed=${report.comet.installed} supported=${report.comet.supported} version=${report.comet.version ?? "-"}`,
    `DRY_RUN ${report.dryRun}`,
    `MANIFEST ${report.manifestPath}`,
    `SUMMARY targets=${report.summary.targets} writes=${report.summary.writes} backups=${report.summary.backups} changed=${report.summary.changed}`
  ];
  if (report.comet.error) lines.push(`ERROR ${report.comet.error}`);
  if (report.backupRoot) lines.push(`BACKUPS ${report.backupRoot}`);
  for (const target of report.targets) {
    const writes = target.writes.filter((plan: CometInstallFilePlan) => plan.action !== "noop");
    lines.push(`TARGET ${target.platformId} writes=${writes.length} skillRoot=${target.skillRoot}`);
    for (const write of writes) {
      lines.push(`  WRITE ${write.action} ${write.relativePath}`);
    }
  }
  if (harness) {
    lines.push(
      `HARNESS requested=${harness.requested} initialized=${harness.initialized} adapter=${harness.adapter ?? "-"}`
    );
    if (harness.created.length > 0) lines.push(`  CREATED ${harness.created.join(",")}`);
    if (harness.skipped.length > 0) lines.push(`  SKIPPED ${harness.skipped.join(",")}`);
    if (harness.hint) lines.push(`  HINT ${harness.hint}`);
    if (harness.browsers) {
      lines.push(
        `  BROWSERS requested=${harness.browsers.requested} installed=${harness.browsers.installed}`
      );
      if (harness.browsers.command) lines.push(`  BROWSER_COMMAND ${harness.browsers.command}`);
      if (harness.browsers.skippedReason) {
        lines.push(`  BROWSER_SKIPPED ${harness.browsers.skippedReason}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatDiffReport(report: CometDiffReport): string {
  const lines = [
    `COMET installed=${report.comet.installed} supported=${report.comet.supported} version=${report.comet.version ?? "-"}`,
    `MANIFEST ${report.manifestPath}`
  ];
  if (report.comet.error) lines.push(`ERROR ${report.comet.error}`);
  if (report.targets.length === 0) {
    lines.push("TARGETS 0");
  } else {
    for (const target of report.targets) {
      lines.push(
        `TARGET ${target.platformId} status=${target.status} skillRoot=${target.skillRoot}`
      );
      lines.push(`  MANIFEST ${target.manifestStatus}`);
      for (const fileChange of target.fileChanges.filter(
        (change: CometDiffFileChange) => change.status !== "clean"
      )) {
        lines.push(`  FILE ${fileChange.status} ${fileChange.relativePath}`);
      }
    }
  }
  return `${lines.join("\n")}\n`;
}

function formatBindReport(report: CometBindReport): string {
  return `CHANGE ${report.change}\nCOMET_YAML ${report.cometYamlPath}\nVERIFY_COMMAND ${report.command}\n`;
}

function formatVerifyReport(report: CometVerifyReport): string {
  return `CHANGE ${report.change}
STATUS ${report.result}
REUSED ${report.reused}
SCENARIOS ${report.selectedScenarios.join(",")}
RECEIPT ${report.receiptPath}
REPORT ${report.reportPath}
GIT_TREE ${report.gitTreeHash}
`;
}

function formatArchiveCheckReport(report: CometArchiveCheckReport): string {
  return `CHANGE ${report.change}
STATUS ${report.status}
RECEIPT ${report.receiptPath}
REPORT ${report.reportPath}
GIT_TREE ${report.gitTreeHash}
`;
}

function formatHookReport(report: CometHookReport): string {
  return `HOOK ${report.hook}\nCHANGE ${report.change}\nSTATUS ${report.status}\n`;
}

function formatUninstallReport(report: CometUninstallReport): string {
  const lines = [
    `COMET installed=${report.comet.installed} supported=${report.comet.supported} version=${report.comet.version ?? "-"}`,
    `MANIFEST ${report.manifestPath}`
  ];
  if (report.comet.error) lines.push(`ERROR ${report.comet.error}`);
  for (const target of report.targets) {
    lines.push(
      `TARGET ${target.platformId} removed=${target.removed.length} kept=${target.kept.length} skillRoot=${target.skillRoot}`
    );
    for (const relativePath of target.removed) lines.push(`  REMOVE ${relativePath}`);
    for (const relativePath of target.kept) lines.push(`  KEEP ${relativePath}`);
  }
  return `${lines.join("\n")}\n`;
}

async function loadCometAdapter(): Promise<typeof import("@hapergg/harness-comet-comet-adapter")> {
  const sourceModuleUrl = new URL("../../../comet-adapter/src/index.ts", import.meta.url);
  if (import.meta.url.includes("/packages/cli/src/")) {
    return await import(sourceModuleUrl.href);
  }

  try {
    const adapter = await import("@hapergg/harness-comet-comet-adapter");
    if (
      "buildCometDiscoveryReport" in adapter &&
      "archiveCheckCometChange" in adapter &&
      "bindCometVerifyCommand" in adapter &&
      "runCometOpenHook" in adapter &&
      "runCometDesignHook" in adapter &&
      "runCometBuildHook" in adapter &&
      "verifyCometChange" in adapter &&
      "readHarnessImpact" in adapter &&
      "writeHarnessImpact" in adapter &&
      "parseAssetDecisionTable" in adapter &&
      "installCometIntegration" in adapter &&
      "diffCometIntegration" in adapter &&
      "syncCometIntegration" in adapter &&
      "uninstallCometIntegration" in adapter
    ) {
      return adapter;
    }
  } catch {
    // Fall back to the local source module in dev/test flows where the workspace package
    // export may still point at stale build artifacts.
  }
  return await import(sourceModuleUrl.href);
}
