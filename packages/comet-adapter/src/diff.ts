import fs from "node:fs/promises";
import path from "node:path";
import { detectCometCli } from "./discovery/comet-cli.js";
import {
  HARNESS_COMET_MANIFEST_PATH,
  readManifest,
  sha256
} from "./manifest.js";
import { getProjectPlatformRegistry } from "./platforms/registry.js";
import { PATCHED_SKILL_FILES, hasManagedPatch } from "./assets.js";
import type {
  AgentTargetManifestRecord,
  CometDiffFileChange,
  CometDiffReport,
  CometDiffTargetReport
} from "./types.js";

export async function diffCometIntegration(projectRoot: string): Promise<CometDiffReport> {
  const [comet, manifest] = await Promise.all([
    detectCometCli(projectRoot),
    readManifest(projectRoot)
  ]);
  const registry = getProjectPlatformRegistry();
  const targets: CometDiffTargetReport[] = [];

  for (const entry of registry) {
    const skillRoot = path.join(projectRoot, entry.skillRoot);
    const manifestRecord = manifest?.targets.find((target) => target.platformId === entry.id);
    if (!manifestRecord && !(await hasCometPhaseSkills(skillRoot))) continue;
    targets.push(await diffTarget(entry.id, skillRoot, manifestRecord));
  }

  return {
    comet,
    manifestPath: path.join(projectRoot, HARNESS_COMET_MANIFEST_PATH),
    targets: targets.sort((a, b) => a.platformId.localeCompare(b.platformId))
  };
}

async function hasCometPhaseSkills(skillRoot: string): Promise<boolean> {
  try {
    await Promise.all(
      PATCHED_SKILL_FILES.map((relativePath) => fs.access(path.join(skillRoot, relativePath)))
    );
    return true;
  } catch {
    return false;
  }
}

async function diffTarget(
  platformId: string,
  skillRoot: string,
  manifestRecord: AgentTargetManifestRecord | undefined
): Promise<CometDiffTargetReport> {
  const fileChanges: CometDiffFileChange[] = [];

  const trackedFiles = manifestRecord?.managedFiles.map((file) => file.relativePath) ?? [...PATCHED_SKILL_FILES];
  const manifestHashes = new Map(manifestRecord?.managedFiles.map((record) => [record.relativePath, record.sha256]) ?? []);

  for (const relativePath of trackedFiles) {
    const fullPath = path.join(skillRoot, relativePath);

    try {
      const current = await fs.readFile(fullPath, "utf8");
      const expectedHash = manifestHashes.get(relativePath);
      if (expectedHash) {
        fileChanges.push({ relativePath, status: sha256(current) === expectedHash ? "clean" : "drift" });
      } else if (hasManagedPatch(relativePath, current)) {
        fileChanges.push({ relativePath, status: "drift" });
      } else {
        fileChanges.push({ relativePath, status: "create" });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      fileChanges.push({ relativePath, status: "create" });
    }
  }

  const status = fileChanges.some((change) => change.status === "drift")
    ? "drift"
    : fileChanges.some((change) => change.status === "create")
      ? "pending"
      : "clean";

  const manifestStatus = getManifestStatus(fileChanges, manifestRecord);
  return { platformId, skillRoot, status, manifestStatus, fileChanges };
}

function getManifestStatus(
  fileChanges: CometDiffFileChange[],
  manifestRecord: AgentTargetManifestRecord | undefined
): "missing" | "unchanged" | "changed" {
  if (!manifestRecord) return "missing";
  if (fileChanges.some((change) => change.status !== "clean")) return "changed";

  const hashes = new Map(manifestRecord.managedFiles.map((record) => [record.relativePath, record.sha256]));
  for (const record of manifestRecord.managedFiles) {
    if (hashes.get(record.relativePath) !== record.sha256) {
      return "changed";
    }
  }

  return "unchanged";
}
