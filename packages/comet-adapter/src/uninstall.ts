import fs from "node:fs/promises";
import { HarnessError } from "@harness-comet/core";
import { removeManagedPatch } from "./assets.js";
import { detectCometCli } from "./discovery/comet-cli.js";
import {
  readManifest,
  replaceManifest
} from "./manifest.js";
import type {
  AgentTargetManifestRecord,
  CometUninstallReport,
  CometUninstallTargetReport
} from "./types.js";

export interface UninstallCometOptions {
  projectRoot: string;
  platformIds?: string[];
}

export async function uninstallCometIntegration(
  options: UninstallCometOptions
): Promise<CometUninstallReport> {
  const manifest = await readManifest(options.projectRoot);
  if (!manifest) {
    throw new HarnessError({
      code: "COMET_MANIFEST_MISSING",
      category: "config",
      message: "No harness-comet manifest found for comet uninstall"
    });
  }

  const comet = await detectCometCli(options.projectRoot);
  const requested = new Set(options.platformIds ?? []);
  const selected =
    requested.size === 0
      ? manifest.targets
      : manifest.targets.filter((target) => requested.has(target.platformId));

  if (selected.length === 0) {
    throw new HarnessError({
      code: "COMET_UNINSTALL_TARGETS_NOT_FOUND",
      category: "selection",
      message: "No installed harness-comet targets matched the uninstall selection"
    });
  }

  const reports: CometUninstallTargetReport[] = [];
  for (const target of selected) {
    reports.push(await uninstallTarget(target));
  }

  const remaining = manifest.targets.filter((target) => !selected.some((item) => item.platformId === target.platformId));
  const manifestPath = await replaceManifest(options.projectRoot, remaining);

  return {
    comet,
    manifestPath,
    manifestWritten: true,
    targets: reports
  };
}

async function uninstallTarget(
  target: AgentTargetManifestRecord
): Promise<CometUninstallTargetReport> {
  const removed: string[] = [];
  const kept: string[] = [];

  for (const managedFile of target.managedFiles) {
    try {
      const current = await fs.readFile(managedFile.absolutePath, "utf8");
      const next = removeManagedPatch(managedFile.relativePath, current);
      if (next !== current) {
        await fs.writeFile(managedFile.absolutePath, next, "utf8");
        removed.push(managedFile.relativePath);
      } else {
        kept.push(managedFile.relativePath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }

  return {
    platformId: target.platformId,
    skillRoot: target.skillRoot,
    removed,
    kept
  };
}
