import fs from "node:fs/promises";
import path from "node:path";
import type { SkillRootIssue } from "../types.js";

export const REQUIRED_SKILL_ROOT_FILES = [
  "comet/SKILL.md",
  "comet-open/SKILL.md",
  "comet-design/SKILL.md",
  "comet-build/SKILL.md",
  "comet-verify/SKILL.md",
  "comet-archive/SKILL.md",
  "comet/scripts/comet-state.sh",
  "comet/scripts/comet-guard.sh",
  "comet/scripts/comet-archive.sh"
];

export async function validateRequiredFiles(skillRoot: string): Promise<SkillRootIssue[]> {
  const issues: SkillRootIssue[] = [];
  for (const relativePath of REQUIRED_SKILL_ROOT_FILES) {
    const fullPath = path.join(skillRoot, relativePath);
    try {
      await fs.access(fullPath);
    } catch {
      issues.push({
        code: "required-file-missing",
        message: `Required Comet file is missing: ${relativePath}`,
        path: fullPath
      });
    }
  }
  return issues;
}
