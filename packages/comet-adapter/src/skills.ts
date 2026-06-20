import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HarnessError } from "@hapergg/harness-comet-core";
import { getProjectPlatformRegistry } from "./platforms/registry.js";

export interface InstallSkillOptions {
  projectRoot: string;
  name: string;
  platformIds?: string[];
  force?: boolean;
  dryRun?: boolean;
}

export interface InstallSkillReport {
  name: string;
  sourceRoot: string;
  targets: Array<{ platformId: string; skillRoot: string; files: string[] }>;
  dryRun: boolean;
}

export async function listAvailableSkills(): Promise<string[]> {
  const root = await resolveSkillCatalogRoot();
  const entries = await fs.readdir(root, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await fs.access(path.join(root, entry.name, "SKILL.md"));
      names.push(entry.name);
    } catch {
      // Ignore non-skill directories.
    }
  }
  return names.sort();
}

export async function installSkill(options: InstallSkillOptions): Promise<InstallSkillReport> {
  assertSkillName(options.name);
  const sourceRoot = path.join(await resolveSkillCatalogRoot(), options.name);
  try {
    await fs.access(path.join(sourceRoot, "SKILL.md"));
  } catch {
    throw new HarnessError({
      code: "SKILL_NOT_FOUND",
      category: "selection",
      message: `Unknown skill: ${options.name}`,
      path: sourceRoot
    });
  }

  const files = await collectFiles(sourceRoot);
  const targets = await resolveTargets(options.projectRoot, options.platformIds);
  const results: InstallSkillReport["targets"] = [];

  for (const target of targets) {
    const destinationRoot = path.join(target.skillRoot, options.name);
    const written: string[] = [];
    for (const relativePath of files) {
      const sourcePath = path.join(sourceRoot, relativePath);
      const destinationPath = path.join(destinationRoot, relativePath);
      const content = await fs.readFile(sourcePath);
      let exists = false;
      try {
        const existing = await fs.readFile(destinationPath);
        exists = true;
        if (existing.equals(content)) continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (exists && !options.force) {
        throw new HarnessError({
          code: "SKILL_TARGET_EXISTS",
          category: "config",
          message: `Skill target already exists with different content: ${destinationPath}`,
          path: destinationPath,
          hint: "Use --force to overwrite it."
        });
      }
      written.push(relativePath);
      if (!options.dryRun) {
        await fs.mkdir(path.dirname(destinationPath), { recursive: true });
        await fs.writeFile(destinationPath, content);
      }
    }
    results.push({ platformId: target.platformId, skillRoot: target.skillRoot, files: written });
  }

  return { name: options.name, sourceRoot, targets: results, dryRun: Boolean(options.dryRun) };
}

async function resolveSkillCatalogRoot(): Promise<string> {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "assets", "skills"),
    path.resolve(here, "../../../skills")
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next location.
    }
  }
  throw new HarnessError({
    code: "SKILL_CATALOG_MISSING",
    category: "config",
    message: "Harness Comet skill catalog is missing"
  });
}

async function resolveTargets(projectRoot: string, platformIds?: string[]) {
  const registry = getProjectPlatformRegistry();
  const requested = new Set(platformIds ?? []);
  const targets: Array<{ platformId: string; skillRoot: string }> = [];

  if (requested.size > 0) {
    for (const id of requested) {
      const platform = registry.find((entry) => entry.id === id);
      if (!platform) {
        throw new HarnessError({
          code: "SKILL_PLATFORM_UNKNOWN",
          category: "selection",
          message: `Unknown agent platform: ${id}`
        });
      }
      targets.push({ platformId: id, skillRoot: path.join(projectRoot, platform.skillRoot) });
    }
    return targets.sort((a, b) => a.platformId.localeCompare(b.platformId));
  }

  for (const platform of registry) {
    try {
      await fs.access(path.join(projectRoot, platform.platformRoot));
      targets.push({ platformId: platform.id, skillRoot: path.join(projectRoot, platform.skillRoot) });
    } catch {
      // Not detected in this project.
    }
  }
  if (targets.length === 0) {
    throw new HarnessError({
      code: "SKILL_TARGETS_NOT_FOUND",
      category: "selection",
      message: "No project-local agent platform was detected. Use --platform <id>."
    });
  }
  return targets.sort((a, b) => a.platformId.localeCompare(b.platformId));
}

async function collectFiles(root: string, prefix = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(root, relativePath)));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files.sort();
}

function assertSkillName(name: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    throw new HarnessError({
      code: "SKILL_NAME_INVALID",
      category: "selection",
      message: `Invalid skill name: ${name}`
    });
  }
}
