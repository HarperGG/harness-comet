import fs from "node:fs/promises";
import path from "node:path";
import { HarnessError } from "@hapergg/harness-comet-core";
import { PATCHED_SKILL_FILES, applyManagedPatch, hasManagedPatch } from "./assets.js";
import { detectCometCli, runCometProjectInit } from "./discovery/comet-cli.js";
import {
  PLAYWRIGHT_COMET_REPLACEMENT_FILES,
  PLAYWRIGHT_SHARED_SKILL_FILES,
  readPlaywrightManagedSkillAsset,
  type PlaywrightManagedSkillFile
} from "./managed-skill-assets.js";
import {
  HARNESS_COMET_MANIFEST_PATH,
  buildManagedFileRecord,
  writeFileAtomic,
  writeManifest
} from "./manifest.js";
import { getProjectPlatformRegistry } from "./platforms/registry.js";
import { resolveHarnessCometProjectMode } from "./project-mode.js";
import type {
  AgentTargetManifestRecord,
  CometLanguage,
  CometInstallFilePlan,
  CometInstallReport,
  CometInstallTargetResult
} from "./types.js";

interface PlannedManagedFile extends CometInstallFilePlan {
  content: string;
  mode: number;
  backupSource?: string;
}

interface InstallTargetPlan {
  result: CometInstallTargetResult;
  manifest: AgentTargetManifestRecord;
  filePlans: PlannedManagedFile[];
}

export interface InstallCometOptions {
  projectRoot: string;
  platformIds?: string[];
  allDetected?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  force?: boolean;
  projectMode?: "runtime" | "playwright";
}

export async function installCometIntegration(
  options: InstallCometOptions
): Promise<CometInstallReport> {
  const comet = await detectCometCli(options.projectRoot);
  const projectMode = await resolveHarnessCometProjectMode(options.projectRoot, options.projectMode);
  const manifestPath = path.join(options.projectRoot, HARNESS_COMET_MANIFEST_PATH);
  const requested = new Set(options.platformIds ?? []);
  const hasSelection = requested.size > 0 || Boolean(options.allDetected);

  if (!comet.installed || !comet.supported) {
    return {
      comet,
      dryRun: Boolean(options.dryRun),
      manifestPath,
      manifestWritten: false,
      targets: [],
      summary: { targets: 0, writes: 0, backups: 0, changed: false }
    };
  }

  if ((options.yes || options.dryRun) && !hasSelection) {
    throw new HarnessError({
      code: "COMET_SELECTION_REQUIRED",
      category: "selection",
      message: "Specify --platform or --all-detected for comet install"
    });
  }

  if (!options.dryRun) {
    await runCometProjectInit(options.projectRoot, { yes: options.yes });
  }

  const targets = await resolveInstallTargets(
    options.projectRoot,
    options.platformIds,
    options.allDetected || !hasSelection
  );

  const plannedTargets = await Promise.all(
    targets.map((target) =>
      buildInstallPlan(
        options.projectRoot,
        target.platformId,
        target.skillRoot,
        Boolean(options.force),
        Boolean(options.dryRun),
        projectMode
      )
    )
  );

  let backups = 0;
  let backupRoot: string | undefined;
  const writes = plannedTargets
    .flatMap((target) => target.filePlans)
    .filter((plan) => plan.action !== "noop");

  if (!options.dryRun) {
    for (const target of plannedTargets) {
      for (const plan of target.filePlans) {
        if (plan.action === "noop") continue;
        if (plan.backupSource) {
          backupRoot ??= path.join(
            options.projectRoot,
            ".harness-comet",
            "backups",
            new Date().toISOString().replace(/[:.]/g, "-")
          );
          const relativeBackupPath = path.join(target.result.platformId, plan.relativePath);
          const fullBackupPath = path.join(backupRoot, relativeBackupPath);
          await fs.mkdir(path.dirname(fullBackupPath), { recursive: true });
          await fs.copyFile(plan.backupSource, fullBackupPath);
          backups += 1;
        }
        await writeFileAtomic(plan.absolutePath, plan.content, plan.mode);
      }
    }
    await writeManifest(
      options.projectRoot,
      plannedTargets.map((target) => target.manifest)
    );
  }

  return {
    comet,
    dryRun: Boolean(options.dryRun),
    manifestPath,
    manifestWritten: !options.dryRun,
    backupRoot,
    targets: plannedTargets.map((target) => target.result),
    summary: {
      targets: plannedTargets.length,
      writes: writes.length,
      backups,
      changed: writes.length > 0
    }
  };
}

async function resolveInstallTargets(
  projectRoot: string,
  requestedPlatformIds: string[] | undefined,
  allDetected: boolean | undefined
) {
  const requested = new Set(requestedPlatformIds ?? []);
  if (requested.size === 0 && !allDetected) {
    throw new HarnessError({
      code: "COMET_SELECTION_REQUIRED",
      category: "selection",
      message: "Specify --platform or --all-detected for comet install"
    });
  }

  const registry = getProjectPlatformRegistry();
  const registryById = new Map(registry.map((entry) => [entry.id, entry]));
  for (const id of requested) {
    if (!registryById.has(id)) {
      throw new HarnessError({
        code: "COMET_PLATFORM_UNKNOWN",
        category: "selection",
        message: `Unknown Comet platform: ${id}`
      });
    }
  }

  const targets: Array<{ platformId: string; skillRoot: string }> = [];
  if (requested.size > 0) {
    for (const id of requested) {
      const entry = registryById.get(id);
      if (!entry) continue;
      targets.push({ platformId: entry.id, skillRoot: path.join(projectRoot, entry.skillRoot) });
    }
    return targets.sort((a, b) => a.platformId.localeCompare(b.platformId));
  }

  for (const entry of registry) {
    const skillRoot = path.join(projectRoot, entry.skillRoot);
    if (!(await hasRequiredPhaseSkills(skillRoot))) continue;
    targets.push({ platformId: entry.id, skillRoot });
  }

  if (targets.length === 0) {
    throw new HarnessError({
      code: "COMET_TARGETS_NOT_FOUND",
      category: "selection",
      message: "No detected Comet platform targets matched the install selection"
    });
  }

  return targets.sort((a, b) => a.platformId.localeCompare(b.platformId));
}

async function buildInstallPlan(
  projectRoot: string,
  platformId: string,
  skillRoot: string,
  force: boolean,
  dryRun: boolean,
  projectMode: "runtime" | "playwright"
): Promise<InstallTargetPlan> {
  if (!dryRun) await validateRequiredPhaseSkills(skillRoot);
  const language = await detectCometLanguage(projectRoot, skillRoot);
  const filePlans: PlannedManagedFile[] = [];
  const managedFiles = [];

  if (projectMode === "playwright") {
    const files: PlaywrightManagedSkillFile[] = [
      ...PLAYWRIGHT_COMET_REPLACEMENT_FILES,
      ...PLAYWRIGHT_SHARED_SKILL_FILES
    ];
    for (const relativePath of files) {
      const absolutePath = path.join(skillRoot, relativePath);
      const content = await readPlaywrightManagedSkillAsset(relativePath, language);
      const requiredExisting = (PLAYWRIGHT_COMET_REPLACEMENT_FILES as readonly string[]).includes(
        relativePath
      );
      const plan = await planReplacementFile({
        relativePath,
        absolutePath,
        content,
        mode: 0o644,
        force,
        dryRun,
        requiredExisting
      });
      filePlans.push(plan);
      managedFiles.push(buildManagedFileRecord(relativePath, absolutePath, content, false));
    }
  } else {
    for (const relativePath of PATCHED_SKILL_FILES) {
      const absolutePath = path.join(skillRoot, relativePath);
      const plan = await planRuntimePatchedFile(
        relativePath,
        absolutePath,
        0o644,
        force,
        dryRun,
        language
      );
      filePlans.push(plan);
      managedFiles.push(buildManagedFileRecord(relativePath, absolutePath, plan.content, false));
    }
  }

  return {
    result: {
      platformId,
      skillRoot,
      writes: filePlans.map(({ content: _content, mode: _mode, backupSource: _backup, ...plan }) => plan)
    },
    manifest: {
      platformId,
      skillRoot,
      installedAt: new Date().toISOString(),
      language,
      managedFiles
    },
    filePlans
  };
}

async function validateRequiredPhaseSkills(skillRoot: string): Promise<void> {
  for (const relativePath of PATCHED_SKILL_FILES) {
    const fullPath = path.join(skillRoot, relativePath);
    try {
      await fs.access(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      throw new HarnessError({
        code: "COMET_PHASE_SKILL_MISSING",
        category: "config",
        message: `Required Comet phase skill is missing: ${relativePath} (${fullPath})`
      });
    }
  }
}

async function hasRequiredPhaseSkills(skillRoot: string): Promise<boolean> {
  try {
    await Promise.all(
      PATCHED_SKILL_FILES.map((relativePath) => fs.access(path.join(skillRoot, relativePath)))
    );
    return true;
  } catch {
    return false;
  }
}

async function detectCometLanguage(projectRoot: string, skillRoot: string): Promise<CometLanguage> {
  const configPath = path.join(projectRoot, ".comet", "config.yaml");
  try {
    const config = await fs.readFile(configPath, "utf8");
    const language = parseLanguage(config);
    if (language) return language;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  for (const relativePath of ["comet-open/SKILL.md", "comet-design/SKILL.md"]) {
    try {
      const content = await fs.readFile(path.join(skillRoot, relativePath), "utf8");
      const language = parseLanguage(content);
      if (language) return language;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return "en";
}

function parseLanguage(content: string): CometLanguage | undefined {
  if (/(language|locale)\s*:\s*("?)(zh|zh-cn|chinese|中文)\2/i.test(content)) return "zh";
  if (/(language|locale)\s*:\s*("?)(en|en-us|english|英文)\2/i.test(content)) return "en";
  if (/[\u4e00-\u9fff]/.test(content)) return "zh";
  return undefined;
}

async function planRuntimePatchedFile(
  relativePath: string,
  absolutePath: string,
  mode: number,
  force: boolean,
  dryRun: boolean,
  language: CometLanguage
): Promise<PlannedManagedFile> {
  try {
    const current = await fs.readFile(absolutePath, "utf8");
    const content = applyManagedPatch(relativePath, current, language, "runtime");
    if (current === content) return noopPlan(relativePath, absolutePath, content, mode);
    if (!force && hasManagedPatch(relativePath, current)) {
      throw managedConflict(absolutePath);
    }
    return updatePlan(relativePath, absolutePath, content, mode);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (!dryRun) throw requiredFileMissing(absolutePath);
    return createPlan(relativePath, absolutePath, applyManagedPatch(relativePath, "", language, "runtime"), mode);
  }
}

async function planReplacementFile(options: {
  relativePath: string;
  absolutePath: string;
  content: string;
  mode: number;
  force: boolean;
  dryRun: boolean;
  requiredExisting: boolean;
}): Promise<PlannedManagedFile> {
  try {
    const current = await fs.readFile(options.absolutePath, "utf8");
    if (current === options.content) {
      return noopPlan(options.relativePath, options.absolutePath, options.content, options.mode);
    }
    const managed = current.includes("Managed by @hapergg/harness-comet");
    if (!options.force && managed) throw managedConflict(options.absolutePath);
    if (!options.force && !options.requiredExisting && !managed) {
      throw new HarnessError({
        code: "COMET_SHARED_SKILL_CONFLICT",
        category: "config",
        message: `Refusing to overwrite an existing non-managed skill: ${options.absolutePath}`,
        hint: "Use --force to back up and replace the existing skill."
      });
    }
    return updatePlan(options.relativePath, options.absolutePath, options.content, options.mode);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (options.requiredExisting && !options.dryRun) throw requiredFileMissing(options.absolutePath);
    return createPlan(options.relativePath, options.absolutePath, options.content, options.mode);
  }
}

function noopPlan(
  relativePath: string,
  absolutePath: string,
  content: string,
  mode: number
): PlannedManagedFile {
  return { relativePath, absolutePath, action: "noop", executable: mode === 0o755, content, mode };
}

function createPlan(
  relativePath: string,
  absolutePath: string,
  content: string,
  mode: number
): PlannedManagedFile {
  return { relativePath, absolutePath, action: "create", executable: mode === 0o755, content, mode };
}

function updatePlan(
  relativePath: string,
  absolutePath: string,
  content: string,
  mode: number
): PlannedManagedFile {
  return {
    relativePath,
    absolutePath,
    action: "update",
    executable: mode === 0o755,
    content,
    mode,
    backupSource: absolutePath
  };
}

function managedConflict(absolutePath: string): HarnessError {
  return new HarnessError({
    code: "COMET_MANAGED_FILE_CONFLICT",
    category: "config",
    message: `Managed skill differs from the packaged version: ${absolutePath}`,
    hint: "Use --force to back up and replace the locally modified or older managed skill."
  });
}

function requiredFileMissing(absolutePath: string): HarnessError {
  return new HarnessError({
    code: "COMET_REQUIRED_FILE_MISSING",
    category: "config",
    message: `Comet init did not create required file: ${absolutePath}`
  });
}
