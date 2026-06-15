import type { Command } from "commander";
import type {
  HarnessImpactRecord,
  PlaywrightHarnessImpactRecord
} from "@harness-comet/comet-adapter";

interface GlobalOptions {
  root?: string;
  json?: boolean;
}

export function registerImpactCommands(
  program: Command,
  withErrors: (action: (...args: any[]) => Promise<void>) => (...args: any[]) => Promise<void>,
  getOptions: () => GlobalOptions
): void {
  const impact = program.command("impact").description("Harness impact mode helpers for Comet changes");

  impact
    .command("set")
    .requiredOption("--change <change>", "change id")
    .requiredOption("--mode <full|maintain|off>", "impact mode")
    .requiredOption("--reason <text>", "impact reason")
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const adapter = await loadCometAdapter();
        const root = options.root ?? process.cwd();
        const mode = await adapter.resolveHarnessCometProjectMode(root);
        const report = mode === "playwright"
          ? await adapter.writePlaywrightHarnessImpact(root, commandOptions.change, {
              mode: commandOptions.mode,
              reason: commandOptions.reason
            })
          : await adapter.writeHarnessImpact(root, commandOptions.change, {
              mode: commandOptions.mode,
              reason: commandOptions.reason
            });
        const payload = { change: commandOptions.change, path: report.path, impact: report.impact };
        if (options.json) {
          process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatImpactReport(commandOptions.change, report.path, report.impact));
      })
    );

  impact
    .command("show")
    .requiredOption("--change <change>", "change id")
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const adapter = await loadCometAdapter();
        const root = options.root ?? process.cwd();
        const mode = await adapter.resolveHarnessCometProjectMode(root);
        const report = mode === "playwright"
          ? await adapter.readPlaywrightHarnessImpact(root, commandOptions.change)
          : await adapter.readHarnessImpact(root, commandOptions.change);
        const payload = { change: commandOptions.change, path: report.path, impact: report.impact };
        if (options.json) {
          process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
          return;
        }
        process.stdout.write(formatImpactReport(commandOptions.change, report.path, report.impact));
      })
    );
}

function formatImpactReport(
  change: string,
  filePath: string,
  impact: HarnessImpactRecord | PlaywrightHarnessImpactRecord
): string {
  if ("existingPlaywrightAssets" in impact) {
    const lines = [
      `CHANGE ${change}`,
      `FILE ${filePath}`,
      `MODE ${impact.mode}`,
      `REASON ${impact.reason}`,
      `AFFECTED ${impact.affectedCapabilities.join(",") || "-"}`,
      `CANDIDATES ${impact.existingPlaywrightAssets.join(",") || "-"}`,
      `DECISIONS ${impact.preliminaryDecision || "-"}`
    ];
    return `${lines.join("\n")}\n`;
  }
  const lines = [
    `CHANGE ${change}`,
    `FILE ${filePath}`,
    `MODE ${impact.mode}`,
    `REASON ${impact.reason}`,
    `AFFECTED ${impact.affectedCapabilities.join(",") || "-"}`,
    `CANDIDATES ${impact.existingAssetCandidates.join(",") || "-"}`,
    `DECISIONS ${impact.assetDecisions.join(",") || "-"}`
  ];
  return `${lines.join("\n")}\n`;
}

async function loadCometAdapter(): Promise<typeof import("@harness-comet/comet-adapter")> {
  try {
    const adapter = await import("@harness-comet/comet-adapter");
    if (
        "readHarnessImpact" in adapter &&
        "writeHarnessImpact" in adapter &&
        "readPlaywrightHarnessImpact" in adapter &&
        "writePlaywrightHarnessImpact" in adapter &&
        "resolveHarnessCometProjectMode" in adapter &&
        "seedHarnessImpact" in adapter &&
        "seedHarnessDesign" in adapter
    ) {
      return adapter;
    }
  } catch {
    // Fall back to local source in workspace dev/test flows.
  }

  const sourceModuleUrl = new URL("../../../comet-adapter/src/index.ts", import.meta.url);
  return await import(sourceModuleUrl.href);
}
