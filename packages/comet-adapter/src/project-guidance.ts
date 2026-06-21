import fs from "node:fs/promises";
import path from "node:path";

const TARGETS = [
  { id: "codex", skillRoot: ".codex/skills", entryPath: "AGENTS.md" },
  { id: "claude", skillRoot: ".claude/skills", entryPath: "CLAUDE.md" },
  { id: "cursor", skillRoot: ".cursor/skills", entryPath: ".cursor/rules/harness-comet.mdc" },
  {
    id: "github-copilot",
    skillRoot: ".github/skills",
    entryPath: ".github/copilot-instructions.md"
  }
] as const;

type GuidanceTarget = (typeof TARGETS)[number];

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

async function detectSupportedAgents(projectRoot: string): Promise<GuidanceTarget[]> {
  const selected: GuidanceTarget[] = [];
  for (const target of TARGETS) {
    try {
      await fs.access(path.join(projectRoot, target.skillRoot, "comet-archive", "SKILL.md"));
      selected.push(target);
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
    await writeAtomic(filePath, content);
  }
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, content, { mode: 0o644, encoding: "utf8" });
  await fs.chmod(tempPath, 0o644);
  await fs.rename(tempPath, filePath);
}
