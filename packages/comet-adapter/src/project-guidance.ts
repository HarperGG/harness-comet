import fs from "node:fs/promises";
import path from "node:path";
import { HarnessError } from "@hapergg/harness-comet-core";
import {
  GUIDANCE_END,
  GUIDANCE_START,
  renderGuidanceEntry
} from "./project-guidance-entries.js";
import {
  PLAYWRIGHT_ACTIVATION_END,
  PLAYWRIGHT_ACTIVATION_START,
  RULES_PLAYWRIGHT_END,
  RULES_PLAYWRIGHT_START,
  playwrightActivationBlock,
  playwrightPolicyTemplate,
  playwrightRulesBlock,
  rulesTemplate
} from "./project-guidance-policy-templates.js";
import {
  playwrightAssetValidatorTemplate,
  playwrightPolicyTemplate as legacyPlaywrightPolicyTemplate,
  rulesTemplate as legacyRulesTemplate,
  structureTemplate,
  type GuidanceLanguage
} from "./project-guidance-templates.js";
import { installPackagedSkill } from "./skill-catalog.js";
import { getProjectPlatformRegistry } from "./platforms/registry.js";

export type ProjectGuidanceAgent = "all" | "codex" | "claude" | "cursor" | "github-copilot";

export interface ProjectGuidanceInitOptions {
  agents?: string[];
  language?: GuidanceLanguage;
  syncInstalledSkills?: boolean;
}

const TARGETS = [
  { id: "codex", entryPath: "AGENTS.md" },
  { id: "claude", entryPath: "CLAUDE.md" },
  { id: "cursor", entryPath: ".cursor/rules/harness-comet.mdc" },
  {
    id: "github-copilot",
    entryPath: ".github/copilot-instructions.md"
  }
] as const;

const SYNCED_PLAYWRIGHT_SKILLS = ["playwright-authoring", "playwright-planner"] as const;

type GuidanceTarget = (typeof TARGETS)[number];

const VALID_AGENTS = new Set<string>([
  "all",
  "codex",
  "claude",
  "cursor",
  "github-copilot"
]);

export async function initializeProjectGuidance(
  projectRoot: string,
  options: ProjectGuidanceInitOptions = {}
): Promise<void> {
  const language = options.language ?? await detectGuidanceLanguage(projectRoot);

  const agentsRoot = path.join(projectRoot, ".agents");
  await fs.mkdir(agentsRoot, { recursive: true });
  await syncRulesFile(path.join(agentsRoot, "rules.md"), language);
  await writeIfMissing(path.join(agentsRoot, "structure.md"), structureTemplate(language));
  await syncPlaywrightPolicyFile(path.join(agentsRoot, "playwright.md"), language);
  await writeIfMissing(
    path.join(agentsRoot, "scripts", "validate-playwright-assets.mjs"),
    playwrightAssetValidatorTemplate(language)
  );

  for (const target of selectTargets(options.agents)) {
    await patchEntryFile(
      path.join(projectRoot, target.entryPath),
      renderGuidanceEntry(target.id, language)
    );
  }

  if (options.syncInstalledSkills !== false) {
    await syncInstalledPlaywrightSkills(projectRoot);
  }
}

function selectTargets(agents: string[] = ["all"]): GuidanceTarget[] {
  const normalized = agents.length === 0 ? ["all"] : agents;
  const invalid = normalized.filter((agent) => !VALID_AGENTS.has(agent));
  if (invalid.length > 0) {
    throw new HarnessError({
      code: "PROJECT_GUIDANCE_AGENT_INVALID",
      category: "selection",
      message: `Unknown project guidance agent: ${invalid.join(", ")}`,
      hint: "Use one of: all, codex, claude, cursor, github-copilot."
    });
  }
  if (normalized.includes("all")) return [...TARGETS];
  const selected = new Set(normalized);
  return TARGETS.filter((target) => selected.has(target.id));
}

async function detectGuidanceLanguage(projectRoot: string): Promise<GuidanceLanguage> {
  for (const candidate of [
    path.join(projectRoot, ".agents", "playwright.md"),
    path.join(projectRoot, ".agents", "rules.md"),
    path.join(projectRoot, "AGENTS.md"),
    path.join(projectRoot, "CLAUDE.md")
  ]) {
    const content = await readOptional(candidate);
    if (!content) continue;
    return /[\u4e00-\u9fff]/.test(content) ? "zh" : "en";
  }

  const cometConfig = await readOptional(path.join(projectRoot, ".comet", "config.yaml"));
  if (cometConfig) {
    if (/(language|locale)\s*:\s*("?)(zh|zh-cn|chinese)\2/i.test(cometConfig)) return "zh";
    if (/[\u4e00-\u9fff]/.test(cometConfig)) return "zh";
  }
  return "en";
}

async function syncRulesFile(filePath: string, language: GuidanceLanguage): Promise<void> {
  const current = await readOptional(filePath);
  if (current === undefined) {
    await writeAtomic(filePath, rulesTemplate(language));
    return;
  }

  // An untouched legacy Harness-Comet file is safe to replace wholesale with the shorter policy.
  if (current === legacyRulesTemplate(language)) {
    await writeAtomic(filePath, rulesTemplate(language));
    return;
  }

  const managedBlock = playwrightRulesBlock(language);
  let next = replaceManagedBlock(
    current,
    RULES_PLAYWRIGHT_START,
    RULES_PLAYWRIGHT_END,
    managedBlock
  );

  // Customized legacy files are migrated section-by-section so user-authored rules survive.
  if (next === undefined && isLegacyRulesContent(current)) {
    next = replaceMarkdownSection(
      current,
      ["### Playwright testing", "### Playwright 测试"],
      managedBlock
    );
  }

  if (next === undefined && !current.includes(".agents/playwright.md")) {
    next = `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${managedBlock}\n`;
  }

  if (next !== undefined && next !== current) await writeAtomic(filePath, next);
}

async function syncPlaywrightPolicyFile(
  filePath: string,
  language: GuidanceLanguage
): Promise<void> {
  const current = await readOptional(filePath);
  if (current === undefined) {
    await writeAtomic(filePath, playwrightPolicyTemplate(language));
    return;
  }

  // Exact legacy generated files can be fully replaced, reducing prompt size for upgraded projects.
  if (current === legacyPlaywrightPolicyTemplate(language)) {
    await writeAtomic(filePath, playwrightPolicyTemplate(language));
    return;
  }

  const activationBlock = playwrightActivationBlock(language);
  let next = replaceManagedBlock(
    current,
    PLAYWRIGHT_ACTIVATION_START,
    PLAYWRIGHT_ACTIVATION_END,
    activationBlock
  );

  // If the project customized the legacy policy, replace only the mandatory activation sections.
  if (next === undefined && isLegacyPlaywrightPolicy(current)) {
    next = replaceBetweenHeadings(
      current,
      ["## Default testing obligation", "## 默认测试义务"],
      ["## Test actions", "## 测试动作"],
      activationBlock
    );
  }

  if (next !== undefined && next !== current) await writeAtomic(filePath, next);
}

function isLegacyRulesContent(content: string): boolean {
  return content.includes("When work changes user-visible behavior, implements a feature") ||
    content.includes("涉及用户可感知行为、新功能、Bug 修复");
}

function isLegacyPlaywrightPolicy(content: string): boolean {
  return content.includes("Playwright coverage is part of the default delivery") ||
    content.includes("Playwright 测试是功能实现和 Bug 修复的默认交付内容");
}

function replaceManagedBlock(
  content: string,
  startMarker: string,
  endMarker: string,
  replacement: string
): string | undefined {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 && end === -1) return undefined;
  if (start < 0 || end <= start) {
    throw new HarnessError({
      code: "PROJECT_GUIDANCE_MANAGED_BLOCK_CONFLICT",
      category: "config",
      message: `Invalid Harness-Comet managed block: ${startMarker}`
    });
  }
  return `${content.slice(0, start)}${replacement}${content.slice(end + endMarker.length)}`;
}

function replaceMarkdownSection(
  content: string,
  headings: string[],
  replacement: string
): string | undefined {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => headings.includes(line.trim()));
  if (start < 0) return undefined;

  let end = start + 1;
  while (end < lines.length && !/^#{2,3}\s+/.test(lines[end].trim())) end += 1;
  return [...lines.slice(0, start), ...replacement.split("\n"), ...lines.slice(end)].join("\n");
}

function replaceBetweenHeadings(
  content: string,
  startHeadings: string[],
  endHeadings: string[],
  replacement: string
): string | undefined {
  const lines = content.split("\n");
  const start = lines.findIndex((line) => startHeadings.includes(line.trim()));
  if (start < 0) return undefined;
  const relativeEnd = lines
    .slice(start + 1)
    .findIndex((line) => endHeadings.includes(line.trim()));
  if (relativeEnd < 0) return undefined;
  const end = start + 1 + relativeEnd;
  return [...lines.slice(0, start), ...replacement.split("\n"), "", ...lines.slice(end)].join("\n");
}

async function syncInstalledPlaywrightSkills(projectRoot: string): Promise<void> {
  const registry = getProjectPlatformRegistry();

  for (const skillName of SYNCED_PLAYWRIGHT_SKILLS) {
    const platformIds: string[] = [];
    for (const platform of registry) {
      const installedSkill = path.join(projectRoot, platform.skillRoot, skillName, "SKILL.md");
      if (await exists(installedSkill)) platformIds.push(platform.id);
    }
    if (platformIds.length === 0) continue;
    await installPackagedSkill({
      projectRoot,
      name: skillName,
      platformIds,
      force: true
    });
  }
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
  const current = await readOptional(filePath) ?? "";
  const start = current.indexOf(GUIDANCE_START);
  const end = current.indexOf(GUIDANCE_END);
  const managedStart = block.indexOf(GUIDANCE_START);
  const managedOnly = managedStart >= 0 ? block.slice(managedStart) : block;
  let next: string;
  if (start === -1 && end === -1) {
    next = `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${block}\n`;
  } else if (start >= 0 && end > start) {
    next = `${current.slice(0, start)}${managedOnly}${current.slice(end + GUIDANCE_END.length)}`;
  } else {
    throw new HarnessError({
      code: "COMET_AGENT_GUIDANCE_CONFLICT",
      category: "config",
      message: `Invalid Harness-Comet managed block: ${filePath}`
    });
  }

  if (next !== current) await writeAtomic(filePath, next);
}

async function readOptional(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return undefined;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return false;
  }
}

async function writeAtomic(filePath: string, content: string): Promise<void> {
  const tempPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(tempPath, content, { mode: 0o644, encoding: "utf8" });
  await fs.chmod(tempPath, 0o644);
  await fs.rename(tempPath, filePath);
}
