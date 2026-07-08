import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HarnessError } from "@hapergg/harness-comet-core";
import type { CometLanguage } from "./types.js";

export const PLAYWRIGHT_COMET_REPLACEMENT_FILES = [
  "comet-open/SKILL.md",
  "comet-design/SKILL.md",
  "comet-build/SKILL.md",
  "comet-verify/SKILL.md",
  "comet-archive/SKILL.md"
] as const;

export const PLAYWRIGHT_SHARED_SKILL_FILES = [
  "playwright-authoring/SKILL.md",
  "playwright-planner/SKILL.md",
  "playwright-generator/SKILL.md",
  "playwright-healer/SKILL.md",
  "playwright-impact-analysis/SKILL.md",
  "playwright-authoring-decision/SKILL.md",
  "playwright-authoring-plan/SKILL.md",
  "playwright-authoring-build/SKILL.md",
  "playwright-authoring-verify/SKILL.md"
] as const;

export type PlaywrightManagedSkillFile =
  | (typeof PLAYWRIGHT_COMET_REPLACEMENT_FILES)[number]
  | (typeof PLAYWRIGHT_SHARED_SKILL_FILES)[number];

function resolveAssetsRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "assets");
}

export function isPlaywrightCometReplacementFile(
  relativePath: string
): relativePath is (typeof PLAYWRIGHT_COMET_REPLACEMENT_FILES)[number] {
  return (PLAYWRIGHT_COMET_REPLACEMENT_FILES as readonly string[]).includes(relativePath);
}

export async function readPlaywrightManagedSkillAsset(
  relativePath: PlaywrightManagedSkillFile,
  language: CometLanguage
): Promise<string> {
  const assetsRoot = resolveAssetsRoot();
  const candidate = isPlaywrightCometReplacementFile(relativePath)
    ? path.join(assetsRoot, "comet-skills", "playwright", language, relativePath)
    : path.join(assetsRoot, "shared-skills", relativePath);

  try {
    return await fs.readFile(candidate, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    if (language !== "en" && isPlaywrightCometReplacementFile(relativePath)) {
      const fallback = path.join(assetsRoot, "comet-skills", "playwright", "en", relativePath);
      try {
        return await fs.readFile(fallback, "utf8");
      } catch (fallbackError) {
        if ((fallbackError as NodeJS.ErrnoException).code !== "ENOENT") throw fallbackError;
      }
    }
    throw new HarnessError({
      code: "COMET_MANAGED_ASSET_MISSING",
      category: "config",
      message: `Managed skill asset is missing: ${relativePath}`,
      path: candidate
    });
  }
}
