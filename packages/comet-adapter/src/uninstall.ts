import fs from "node:fs/promises";
import path from "node:path";
import { HarnessError } from "@hapergg/harness-comet-core";
import { removeManagedPatch } from "./assets.js";
import { detectCometCli } from "./discovery/comet-cli.js";
import { readManifest, replaceManifest, sha256 } from "./manifest.js";
import type {
  AgentTargetManifestRecord,
  CometUninstallReport,
  CometUninstallTargetReport,
  ManagedFileRecord
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
  const successfullyUninstalled = new Set<string>();
  for (const target of selected) {
    const report = await uninstallTarget(target);
    reports.push(report);
    if (report.kept.length === 0) successfullyUninstalled.add(target.platformId);
  }

  const remaining = manifest.targets.filter(
    (target) => !successfullyUninstalled.has(target.platformId)
  );
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
      const strategy = managedFile.strategy ?? "patch";

      if (strategy === "patch") {
        const next = removeManagedPatch(managedFile.relativePath, current);
        if (next !== current) {
          await fs.writeFile(managedFile.absolutePath, next, "utf8");
          removed.push(managedFile.relativePath);
        } else {
          kept.push(managedFile.relativePath);
        }
        continue;
      }

      if (sha256(current) !== managedFile.sha256) {
        kept.push(managedFile.relativePath);
        continue;
      }

      if (strategy === "create") {
        await fs.rm(managedFile.absolutePath, { force: true });
        await removeEmptyParentDirectory(managedFile.absolutePath, target.skillRoot);
        removed.push(managedFile.relativePath);
        continue;
      }

      if (!managedFile.backupPath) {
        kept.push(managedFile.relativePath);
        continue;
      }

      try {
        await fs.access(managedFile.backupPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        kept.push(managedFile.relativePath);
        continue;
      }

      await fs.mkdir(path.dirname(managedFile.absolutePath), { recursive: true });
      await fs.copyFile(managedFile.backupPath, managedFile.absolutePath);
      removed.push(managedFile.relativePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        if (managedFile.strategy === "create") removed.push(managedFile.relativePath);
        continue;
      }
      throw error;
    }
  }

  return {
    platformId: target.platformId,
    skillRoot: target.skillRoot,
    removed,
    kept
  };
}

async function removeEmptyParentDirectory(filePath: string, skillRoot: string): Promise<void> {
  const parent = path.dirname(filePath);
  if (path.resolve(parent) === path.resolve(skillRoot)) return;
  try {
    const entries = await fs.readdir(parent);
    if (entries.length === 0) await fs.rmdir(parent);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
