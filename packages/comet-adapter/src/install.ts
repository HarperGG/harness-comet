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
  HARNESS_COMET_STATE_DIR,
  buildManagedFileRecord,
  readManifest,
  sha256,
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
  CometInstallTargetResult,
  ManagedFileRecord,
  ManagedFileStrategy
} from "./types.js";

interface PlannedManagedFile extends CometInstallFilePlan {
  content: string;
  mode: number;
  backupSource?: string;
  backupPath?: string;
  strategy: ManagedFileStrategy;
  managed: boolean;
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
  const existingManifest = await readManifest(options.projectRoot);
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
        projectMode,
        existingManifest?.targets.find((item) => item.platformId === target.platformId)
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
            HARNESS_COMET_STATE_DIR,
            "backups",
            new Date().toISOString().replace(/[:.]/g, "-")
          );
          const fullBackupPath = path.join(backupRoot, target.result.platformId, plan.relativePath);
          await fs.mkdir(path.dirname(fullBackupPath), { recursive: true });
          await fs.copyFile(plan.backupSource, fullBackupPath);
          plan.backupPath = fullBackupPath;
          const record = target.manifest.managedFiles.find(
            (item) => item.relativePath === plan.relativePath
          );
          if (record) record.backupPath = fullBackupPath;
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
  projectMode: "runtime" | "playwright",
  previousTarget?: AgentTargetManifestRecord
): Promise<InstallTargetPlan> {
  if (!dryRun) await validateRequiredPhaseSkills(skillRoot);
  const language = await detectCometLanguage(projectRoot, skillRoot);
  const filePlans: PlannedManagedFile[] = [];
  const managedFiles: ManagedFileRecord[] = [];

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
      const previous = previousTarget?.managedFiles.find(
        (item) => item.relativePath === relativePath
      );
      const plan = await planReplacementFile({
        relativePath,
        absolutePath,
        content,
        mode: 0o644,
        force,
        dryRun,
        requiredExisting,
        previous
      });
      filePlans.push(plan);
      if (plan.managed) {
        managedFiles.push(
          buildManagedFileRecord(
            relativePath,
            absolutePath,
            content,
            false,
            plan.strategy,
            plan.backupPath
          )
        );
      }
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
      managedFiles.push(
        buildManagedFileRecord(relativePath, absolutePath, plan.content, false, "patch")
      );
    }
  }

  return {
    result: {
      platformId,
      skillRoot,
      writes: filePlans.map(
        ({
          content: _content,
          mode: _mode,
          backupSource: _backup,
          backupPath: _path,
          strategy: _strategy,
          managed: _managed,
          ...plan
        }) => plan
      )
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
    if (current === content) return noopPlan(relativePath, absolutePath, content, mode, "patch");
    if (!force && hasManagedPatch(relativePath, current)) throw managedConflict(absolutePath);
    return updatePlan(relativePath, absolutePath, content, mode, "patch");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (!dryRun) throw requiredFileMissing(absolutePath);
    return createPlan(
      relativePath,
      absolutePath,
      applyManagedPatch(relativePath, "", language, "runtime"),
      mode,
      "patch"
    );
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
  previous?: ManagedFileRecord;
}): Promise<PlannedManagedFile> {
  try {
    const current = await fs.readFile(options.absolutePath, "utf8");
    const strategy: ManagedFileStrategy = options.requiredExisting ? "replace" : "create";
    if (current === options.content) {
      return noopPlan(
        options.relativePath,
        options.absolutePath,
        options.content,
        options.mode,
        options.previous?.strategy ?? strategy,
        options.previous?.backupPath
      );
    }

    const previousMatches = Boolean(
      options.previous && sha256(current) === options.previous.sha256
    );
    if (options.previous && !previousMatches && !options.force) {
      throw managedConflict(options.absolutePath);
    }
    if (!options.previous && !options.requiredExisting && !options.force) {
      console.warn(`SKIP existing non-managed skill preserved: ${options.absolutePath}`);
      return noopPlan(
        options.relativePath,
        options.absolutePath,
        current,
        options.mode,
        strategy,
        undefined,
        false
      );
    }

    const effectiveStrategy: ManagedFileStrategy = options.requiredExisting || !options.previous
      ? "replace"
      : options.previous.strategy ?? "replace";
    return updatePlan(
      options.relativePath,
      options.absolutePath,
      options.content,
      options.mode,
      effectiveStrategy,
      options.previous?.backupPath,
      options.previous?.backupPath ? undefined : options.absolutePath
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (options.requiredExisting && !options.dryRun) throw requiredFileMissing(options.absolutePath);
    return createPlan(options.relativePath, options.absolutePath, options.content, options.mode, "create");
  }
}

function noopPlan(
  relativePath: string,
  absolutePath: string,
  content: string,
  mode: number,
  strategy: ManagedFileStrategy,
  backupPath?: string,
  managed = true
): PlannedManagedFile {
  return {
    relativePath,
    absolutePath,
    action: "noop",
    executable: mode === 0o755,
    content,
    mode,
    strategy,
    backupPath,
    managed
  };
}

function createPlan(
  relativePath: string,
  absolutePath: string,
  content: string,
  mode: number,
  strategy: ManagedFileStrategy
): PlannedManagedFile {
  return {
    relativePath,
    absolutePath,
    action: "create",
    executable: mode === 0o755,
    content,
    mode,
    strategy,
    managed: true
  };
}

function updatePlan(
  relativePath: string,
  absolutePath: string,
  content: string,
  mode: number,
  strategy: ManagedFileStrategy,
  backupPath?: string,
  backupSource: string | undefined = absolutePath
): PlannedManagedFile {
  return {
    relativePath,
    absolutePath,
    action: "update",
    executable: mode === 0o755,
    content,
    mode,
    strategy,
    backupPath,
    backupSource,
    managed: true
  };
}

function managedConflict(absolutePath: string): HarnessError {
  return new HarnessError({
    code: "COMET_MANAGED_FILE_CONFLICT",
    category: "config",
    message: `Managed skill has local changes: ${absolutePath}`,
    hint: "Use --force to back up and replace the locally modified skill."
  });
}

function requiredFileMissing(absolutePath: string): HarnessError {
  return new HarnessError({
    code: "COMET_REQUIRED_FILE_MISSING",
    category: "config",
    message: `Comet init did not create required file: ${absolutePath}`
  });
}
