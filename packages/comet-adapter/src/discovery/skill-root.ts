import fs from "node:fs/promises";
import type { SkillRootStatus } from "../types.js";
import { validateRequiredFiles } from "../compatibility/file-contract.js";

export async function validateSkillRoot(
  platformId: string,
  skillRoot: string
): Promise<SkillRootStatus> {
  try {
    await fs.access(skillRoot);
  } catch {
    return {
      platformId,
      detected: false,
      valid: false,
      skillRoot,
      issues: [
        {
          code: "skill-root-missing",
          message: "Skill Root is missing",
          path: skillRoot
        }
      ]
    };
  }
  const issues = await validateRequiredFiles(skillRoot);
  return {
    platformId,
    detected: true,
    valid: issues.length === 0,
    skillRoot,
    issues
  };
}
