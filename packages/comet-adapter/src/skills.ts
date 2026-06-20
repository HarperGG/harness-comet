import fs from "node:fs/promises";
import path from "node:path";
import { HarnessError } from "@hapergg/harness-comet-core";
import {
  installPackagedSkill,
  listPackagedSkills
} from "./skill-catalog.js";

const SUPPORTED_PLATFORMS = new Set(["codex", "claude"]);

export const listAvailableSkills = listPackagedSkills;

export async function installSkill(options: {
  projectRoot: string;
  name: string;
  platformIds?: string[];
  force?: boolean;
  dryRun?: boolean;
}) {
  const requested = options.platformIds ?? [];
  for (const id of requested) {
    if (!SUPPORTED_PLATFORMS.has(id)) {
      throw new HarnessError({
        code: "SKILL_PLATFORM_UNSUPPORTED",
        category: "selection",
        message: `Standalone skill installation currently supports only codex and claude: ${id}`
      });
    }
  }

  const platformIds = requested.length > 0
    ? requested
    : await detectSupportedPlatforms(options.projectRoot);

  if (platformIds.length === 0) {
    throw new HarnessError({
      code: "SKILL_TARGETS_NOT_FOUND",
      category: "selection",
      message: "No Codex or Claude project directory was detected. Use --platform codex or --platform claude."
    });
  }

  return installPackagedSkill({ ...options, platformIds });
}

async function detectSupportedPlatforms(projectRoot: string): Promise<string[]> {
  const detected: string[] = [];
  for (const [id, directory] of [["codex", ".codex"], ["claude", ".claude"]] as const) {
    try {
      await fs.access(path.join(projectRoot, directory));
      detected.push(id);
    } catch {
      // Platform is not configured in this project.
    }
  }
  return detected;
}
