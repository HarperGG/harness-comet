import fs from "node:fs/promises";
import path from "node:path";
import { HarnessError } from "@hapergg/harness-comet-core";
import {
  GUIDANCE_END,
  GUIDANCE_START,
  renderGuidanceEntry
} from "./project-guidance-entries.js";
import {
  rulesTemplate,
  structureTemplate,
  type GuidanceLanguage
} from "./project-guidance-templates.js";

const TARGETS = [
  { id: "codex", entryPath: "AGENTS.md" },
  { id: "claude", entryPath: "CLAUDE.md" },
  { id: "cursor", entryPath: ".cursor/rules/harness-comet.mdc" },
  {
    id: "github-copilot",
    entryPath: ".github/copilot-instructions.md"
  }
] as const;

export async function initializeProjectGuidance(projectRoot: string): Promise<void> {
  const language = await detectGuidanceLanguage(projectRoot);

  const agentsRoot = path.join(projectRoot, ".agents");
  await fs.mkdir(agentsRoot, { recursive: true });
  await writeIfMissing(path.join(agentsRoot, "rules.md"), rulesTemplate(language));
  await writeIfMissing(path.join(agentsRoot, "structure.md"), structureTemplate(language));

  for (const target of TARGETS) {
    await patchEntryFile(
      path.join(projectRoot, target.entryPath),
      renderGuidanceEntry(target.id, language)
    );
  }
}

async function detectGuidanceLanguage(projectRoot: string): Promise<GuidanceLanguage> {
  const candidates = [path.join(projectRoot, ".comet", "config.yaml")];
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

async function patchEntryFile(filePath: string, block: string): Promise<void> {
  let current = "";
  try {
    current = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const start = current.indexOf(GUIDANCE_START);
  const end = current.indexOf(GUIDANCE_END);
  let next: string;
  if (start === -1 && end === -1) {
    next = `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${block}\n`;
  } else if (start >= 0 && end > start) {
    next = `${current.slice(0, start)}${block}${current.slice(end + GUIDANCE_END.length)}`;
  } else {
    throw new HarnessError({
      code: "COMET_AGENT_GUIDANCE_CONFLICT",
      category: "config",
      message: `Invalid Harness-Comet managed block: ${filePath}`
    });
  }

  if (next !== current) await writeAtomic(filePath, next);
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, content, { mode: 0o644, encoding: "utf8" });
  await fs.chmod(tempPath, 0o644);
  await fs.rename(tempPath, filePath);
}
