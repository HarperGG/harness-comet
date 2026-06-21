import fs from "node:fs/promises";
import path from "node:path";
import { writeFileAtomic } from "./manifest.js";

export async function initializeProjectGuidance(projectRoot: string): Promise<void> {
  const selected = await detectSupportedAgents(projectRoot);
  if (selected.length === 0) return;

  const agentsRoot = path.join(projectRoot, ".agents");
  await fs.mkdir(agentsRoot, { recursive: true });
  await writeIfMissing(
    path.join(agentsRoot, "rules.md"),
    "# Project Rules\n\n## Red Lines\n\nNo confirmed red lines yet.\n\n## Engineering Guidelines\n\nNo confirmed engineering guidelines yet.\n"
  );
  await writeIfMissing(
    path.join(agentsRoot, "structure.md"),
    "# Project Structure\n\n## Overview\n\nTo be refined by future archive workflows.\n\n## Important Directories and Modules\n\nTo be documented.\n"
  );
}

async function detectSupportedAgents(projectRoot: string): Promise<string[]> {
  const roots = [".codex/skills", ".claude/skills", ".cursor/skills", ".github/skills"];
  const selected: string[] = [];
  for (const root of roots) {
    try {
      await fs.access(path.join(projectRoot, root, "comet-archive", "SKILL.md"));
      selected.push(root);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return selected;
}

async function writeIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await fs.access(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    await writeFileAtomic(filePath, content, 0o644);
  }
}
