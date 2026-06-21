import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HarnessError } from "@hapergg/harness-comet-core";
import { getProjectPlatformRegistry } from "./platforms/registry.js";

export async function listPackagedSkills(): Promise<string[]> {
  const root = catalogRoot();
  const entries = await fs.readdir(root, { withFileTypes: true });
  const names: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      await fs.access(path.join(root, entry.name, "SKILL.md"));
      names.push(entry.name);
    } catch {
      // Ignore catalog entries that are not valid packaged skills.
    }
  }
  return names.sort();
}

export async function installPackagedSkill(options: {
  projectRoot: string;
  name: string;
  platformIds?: string[];
  force?: boolean;
  dryRun?: boolean;
}) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(options.name)) {
    throw new HarnessError({ code: "SKILL_NAME_INVALID", category: "selection", message: `Invalid skill name: ${options.name}` });
  }
  const source = path.join(catalogRoot(), options.name);
  try {
    await fs.access(path.join(source, "SKILL.md"));
  } catch {
    throw new HarnessError({ code: "SKILL_NOT_FOUND", category: "selection", message: `Unknown skill: ${options.name}`, path: source });
  }

  const files = await collectFiles(source);
  const targets = await resolveTargets(options.projectRoot, options.platformIds);
  const results: Array<{ platformId: string; skillRoot: string; files: string[] }> = [];
  for (const target of targets) {
    const written: string[] = [];
    for (const relativePath of files) {
      const sourcePath = path.join(source, relativePath);
      const destination = path.join(target.skillRoot, options.name, relativePath);
      const content = await fs.readFile(sourcePath);
      try {
        const existing = await fs.readFile(destination);
        if (existing.equals(content)) continue;
        if (!options.force) {
          throw new HarnessError({ code: "SKILL_TARGET_EXISTS", category: "config", message: `Skill target already exists with different content: ${destination}`, path: destination, hint: "Use --force to overwrite it." });
        }
      } catch (error) {
        if (error instanceof HarnessError) throw error;
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      written.push(relativePath);
      if (!options.dryRun) {
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.writeFile(destination, content);
      }
    }
    results.push({ platformId: target.platformId, skillRoot: target.skillRoot, files: written });
  }
  return { name: options.name, sourceRoot: source, targets: results, dryRun: Boolean(options.dryRun) };
}

function catalogRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "shared-skills");
}

async function resolveTargets(projectRoot: string, platformIds?: string[]) {
  const registry = getProjectPlatformRegistry();
  const requested = new Set(platformIds ?? []);
  const targets: Array<{ platformId: string; skillRoot: string }> = [];
  if (requested.size > 0) {
    for (const id of requested) {
      const platform = registry.find((entry) => entry.id === id);
      if (!platform) throw new HarnessError({ code: "SKILL_PLATFORM_UNKNOWN", category: "selection", message: `Unknown agent platform: ${id}` });
      targets.push({ platformId: id, skillRoot: path.join(projectRoot, platform.skillRoot) });
    }
    return targets.sort((a, b) => a.platformId.localeCompare(b.platformId));
  }
  for (const platform of registry) {
    try {
      await fs.access(path.join(projectRoot, platform.platformRoot));
      targets.push({ platformId: platform.id, skillRoot: path.join(projectRoot, platform.skillRoot) });
    } catch {
      // Platform roots are optional; absence means the platform is not installed in this project.
    }
  }
  if (targets.length === 0) throw new HarnessError({ code: "SKILL_TARGETS_NOT_FOUND", category: "selection", message: "No project-local agent platform was detected. Use --platform <id>." });
  return targets.sort((a, b) => a.platformId.localeCompare(b.platformId));
}

async function collectFiles(root: string, prefix = ""): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, prefix), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(root, relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files.sort();
}
