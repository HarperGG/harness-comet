import fs from "node:fs/promises";
import path from "node:path";
import type { CometDiscoveryReport, SkillRootStatus } from "../types.js";
import { detectCometCli } from "../discovery/comet-cli.js";
import { validateSkillRoot } from "../discovery/skill-root.js";
import { getProjectPlatformRegistry } from "./registry.js";

export async function discoverProjectSkillRoots(projectRoot: string): Promise<SkillRootStatus[]> {
  const registry = getProjectPlatformRegistry();
  const results: SkillRootStatus[] = [];
  for (const entry of registry) {
    const platformRoot = path.join(projectRoot, entry.platformRoot);
    try {
      await fs.access(platformRoot);
    } catch {
      continue;
    }
    results.push(await validateSkillRoot(entry.id, path.join(projectRoot, entry.skillRoot)));
  }
  return results.sort((a, b) => a.platformId.localeCompare(b.platformId));
}

export async function buildCometDiscoveryReport(
  projectRoot: string
): Promise<CometDiscoveryReport> {
  const [comet, targets] = await Promise.all([
    detectCometCli(projectRoot),
    discoverProjectSkillRoots(projectRoot)
  ]);
  return { comet, targets };
}
