import fs from "node:fs/promises";
import path from "node:path";
import {
  rulesTemplate,
  structureTemplate,
  type GuidanceLanguage
} from "./project-guidance-templates.js";

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
  const language = await detectGuidanceLanguage(projectRoot, selected[0]);

  const agentsRoot = path.join(projectRoot, ".agents");
  await fs.mkdir(agentsRoot, { recursive: true });
  await writeIfMissing(path.join(agentsRoot, "rules.md"), rulesTemplate(language));
  await writeIfMissing(path.join(agentsRoot, "structure.md"), structureTemplate(language));
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

async function detectGuidanceLanguage(
  projectRoot: string,
  target: GuidanceTarget
): Promise<GuidanceLanguage> {
  const candidates = [
    path.join(projectRoot, ".comet", "config.yaml"),
    path.join(projectRoot, target.skillRoot, "comet-open", "SKILL.md")
  ];
  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(candidate, "utf8");
      if (/(language|locale)\s*:\s*("?)(zh|zh-cn|chinese)\2/i.test(content)) return "zh";
      if (/[\u4e00-\u9fff]/.test(content)) return "zh";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return "en";
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
