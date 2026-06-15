import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { SUPPORTED_COMET_RANGE } from "./compatibility/version.js";
import type {
  AgentTargetManifestRecord,
  HarnessCometManifestV1,
  ManagedFileRecord
} from "./types.js";

export const HARNESS_COMET_VERSION = "0.1.0";
export const HARNESS_COMET_MANIFEST_PATH = path.join(".harness-comet", "manifest.json");
export const UPSTREAM_COMET_REPOSITORY = "https://github.com/rpamis/comet";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function readManifest(
  projectRoot: string
): Promise<HarnessCometManifestV1 | undefined> {
  const manifestPath = path.join(projectRoot, HARNESS_COMET_MANIFEST_PATH);
  try {
    const content = await fs.readFile(manifestPath, "utf8");
    return JSON.parse(content) as HarnessCometManifestV1;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function writeManifest(
  projectRoot: string,
  records: AgentTargetManifestRecord[]
): Promise<string> {
  const existing = await readManifest(projectRoot);
  const merged = new Map<string, AgentTargetManifestRecord>();
  for (const record of existing?.targets ?? []) merged.set(record.platformId, record);
  for (const record of records) merged.set(record.platformId, record);
  return await replaceManifest(projectRoot, [...merged.values()]);
}

export async function replaceManifest(
  projectRoot: string,
  records: AgentTargetManifestRecord[]
): Promise<string> {
  const manifestPath = path.join(projectRoot, HARNESS_COMET_MANIFEST_PATH);
  const manifest: HarnessCometManifestV1 = {
    schemaVersion: 1,
    harnessCometVersion: HARNESS_COMET_VERSION,
    compatibleCometRange: SUPPORTED_COMET_RANGE,
    upstreamRepository: UPSTREAM_COMET_REPOSITORY,
    installedAt: new Date().toISOString(),
    targets: [...records].sort((a, b) => a.platformId.localeCompare(b.platformId))
  };

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFileAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 0o644);
  return manifestPath;
}

export function buildManagedFileRecord(
  relativePath: string,
  absolutePath: string,
  content: string,
  executable: boolean
): ManagedFileRecord {
  return {
    relativePath,
    absolutePath,
    sha256: sha256(content),
    executable
  };
}

export async function writeFileAtomic(
  filePath: string,
  content: string,
  mode: number
): Promise<void> {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, content, { mode, encoding: "utf8" });
  await fs.chmod(tempPath, mode);
  await fs.rename(tempPath, filePath);
}
