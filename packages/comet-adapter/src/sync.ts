import { HarnessError } from "@hapergg/harness-comet-core";
import { diffCometIntegration } from "./diff.js";
import { detectCometCli } from "./discovery/comet-cli.js";
import { HARNESS_COMET_MANIFEST_PATH, readManifest } from "./manifest.js";
import type { CometInstallReport, CometInstallTargetResult } from "./types.js";

export async function syncCometIntegration(projectRoot: string): Promise<CometInstallReport> {
  const manifest = await readManifest(projectRoot);
  if (!manifest) {
    throw new HarnessError({
      code: "COMET_MANIFEST_MISSING",
      category: "config",
      message: "No harness-comet manifest found for comet sync"
    });
  }

  const [comet, diff] = await Promise.all([
    detectCometCli(projectRoot),
    diffCometIntegration(projectRoot)
  ]);

  if (!comet.installed || !comet.supported) {
    return {
      comet,
      dryRun: false,
      manifestPath: `${projectRoot}/${HARNESS_COMET_MANIFEST_PATH}`,
      manifestWritten: false,
      targets: [],
      summary: { targets: 0, writes: 0, backups: 0, changed: false }
    };
  }

  for (const target of diff.targets) {
    if (target.status === "drift") {
      const drifted = target.fileChanges.find((change) => change.status === "drift");
      throw new HarnessError({
        code: "COMET_SYNC_DRIFT",
        category: "config",
        message: `Refusing to sync drifted Comet file: ${target.skillRoot}/${drifted?.relativePath ?? ""}`
      });
    }
    if (target.manifestStatus === "changed") {
      throw new HarnessError({
        code: "COMET_SYNC_MANIFEST_CHANGED",
        category: "config",
        message: `Refusing to sync changed Comet manifest target: ${target.platformId}`
      });
    }
  }

  const targets: CometInstallTargetResult[] = manifest.targets.map((target) => ({
    platformId: target.platformId,
    skillRoot: target.skillRoot,
    writes: []
  }));

  return {
    comet,
    dryRun: false,
    manifestPath: `${projectRoot}/${HARNESS_COMET_MANIFEST_PATH}`,
    manifestWritten: false,
    targets,
    summary: {
      targets: targets.length,
      writes: 0,
      backups: 0,
      changed: false
    }
  };
}
