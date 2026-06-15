import fs from "node:fs/promises";
import path from "node:path";
import { HarnessError } from "@harness-comet/core";
import { normalizePlaywrightDecision, type PlaywrightImpactDecision } from "./playwright-impact-policy.js";

export type HarnessImpactMode = "full" | "maintain" | "off";

export interface HarnessImpactRecord {
  mode: HarnessImpactMode;
  reason: string;
  affectedCapabilities: string[];
  existingAssetCandidates: string[];
  assetDecisions: string[];
}

export interface HarnessImpactSeedInput {
  affectedCapabilities?: string[];
  existingAssetCandidates?: string[];
  assetDecisions?: string[];
}

export interface HarnessDesignSeedInput {
  mode: HarnessImpactMode;
  reason: string;
  scenarioRows: Array<{ assetId: string; decision: string; reason: string; contractChange: string; evidence: string }>;
  fixtureRows: Array<{ assetId: string; decision: string; reason: string; contractChange: string; evidence: string }>;
  adapterDecisions: string[];
  oracleDecisions: string[];
}

export interface PlaywrightHarnessImpactRecord {
  mode: HarnessImpactMode;
  reason: string;
  affectedCapabilities: string[];
  existingPlaywrightAssets: string[];
  preliminaryDecision: PlaywrightImpactDecision;
}

export interface PlaywrightTargetTestRecord {
  path: string;
  scenarioId?: string;
  action: PlaywrightImpactDecision;
  reason: string;
}

export interface PlaywrightRelatedFileRecord {
  path: string;
  reason: string;
}

export interface PlaywrightHarnessDesignRecord {
  mode: HarnessImpactMode;
  decision: PlaywrightImpactDecision;
  decisionReason: string;
  targetTests: PlaywrightTargetTestRecord[];
  relatedFiles: PlaywrightRelatedFileRecord[];
  verificationCommands: string[];
}

export function resolveChangeRoot(projectRoot: string, change: string): string {
  return path.join(projectRoot, "openspec", "changes", change);
}

export async function ensureChangeRoot(projectRoot: string, change: string): Promise<string> {
  const changeRoot = resolveChangeRoot(projectRoot, change);
  try {
    await fs.access(changeRoot);
  } catch {
    throw new HarnessError({
      code: "COMET_CHANGE_NOT_FOUND",
      category: "selection",
      message: `Comet change not found: ${change}`,
      path: changeRoot
    });
  }
  return changeRoot;
}

export async function readChangeCometYaml(
  projectRoot: string,
  change: string
): Promise<{ path: string; data: Record<string, unknown> }> {
  const changeRoot = await ensureChangeRoot(projectRoot, change);
  const cometYamlPath = path.join(changeRoot, ".comet.yaml");
  let content = "";
  try {
    content = await fs.readFile(cometYamlPath, "utf8");
  } catch {
    throw new HarnessError({
      code: "COMET_CHANGE_CONFIG_NOT_FOUND",
      category: "config",
      message: `Comet change config not found for ${change}`,
      path: cometYamlPath
    });
  }

  return { path: cometYamlPath, data: parseSimpleYaml(content) };
}

export async function resolveDesignDocPath(projectRoot: string, change: string): Promise<string> {
  const { data } = await readChangeCometYaml(projectRoot, change);
  const changeRoot = resolveChangeRoot(projectRoot, change);
  const configured = typeof data.design_doc === "string" ? data.design_doc : "design.md";
  const candidates = path.isAbsolute(configured)
    ? [configured]
    : [path.join(changeRoot, configured), path.join(projectRoot, configured)];
  const uniqueCandidates = [...new Set(candidates)];
  for (const candidate of uniqueCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next interpretation before reporting the legacy default path.
    }
  }
  return uniqueCandidates[0];
}

export async function readDesignDoc(projectRoot: string, change: string): Promise<{ path: string; content: string }> {
  const designPath = await resolveDesignDocPath(projectRoot, change);
  let content = "";
  try {
    content = await fs.readFile(designPath, "utf8");
  } catch {
    throw new HarnessError({
      code: "COMET_DESIGN_DOC_NOT_FOUND",
      category: "config",
      message: `Comet design doc not found for ${change}`,
      path: designPath
    });
  }
  return { path: designPath, content };
}

export async function readHarnessImpact(
  projectRoot: string,
  change: string
): Promise<{ path: string; impact: HarnessImpactRecord }> {
  const { path: designPath, content } = await readDesignDoc(projectRoot, change);
  const impact = readHarnessImpactFromContent(content);
  if (!impact) {
    throw new HarnessError({
      code: "COMET_DOC_SECTION_MISSING",
      category: "config",
      message: "Missing section: Harness Impact",
      path: designPath
    });
  }

  const mode = impact.mode;
  if (mode !== "full" && mode !== "maintain" && mode !== "off") {
    throw new HarnessError({
      code: "COMET_IMPACT_MODE_INVALID",
      category: "config",
      message: `Harness Impact.Mode must be full, maintain, or off for ${change}`,
      path: designPath
    });
  }

  return {
    path: designPath,
    impact
  };
}

export function readHarnessImpactFromContent(content: string): HarnessImpactRecord | null {
  const section = extractMarkdownSection(content, "Harness Impact");
  if (!section.trim()) return null;
  return {
    mode: extractSingleBulletValue(section, "Mode") as HarnessImpactMode,
    reason: extractSingleBulletValue(section, "Reason"),
    affectedCapabilities: extractBulletList(section, "Affected capabilities"),
    existingAssetCandidates: extractBulletList(section, "Existing asset candidates"),
    assetDecisions: extractBulletList(section, "Asset decisions")
  };
}

export function readPlaywrightHarnessImpactFromContent(
  content: string
): PlaywrightHarnessImpactRecord | null {
  const section = extractMarkdownSection(content, "Harness Playwright Impact");
  if (!section.trim()) return null;
  return {
    mode: extractSingleBulletValue(section, "Mode") as HarnessImpactMode,
    reason: extractSingleBulletValue(section, "Reason"),
    affectedCapabilities: extractBulletList(section, "Affected capabilities"),
    existingPlaywrightAssets: extractBulletList(section, "Existing Playwright assets"),
    preliminaryDecision: normalizePlaywrightDecision(
      extractSingleBulletValue(section, "Preliminary decision")
    )
  };
}

export async function writeHarnessImpact(
  projectRoot: string,
  change: string,
  input: { mode: HarnessImpactMode; reason: string }
): Promise<{ path: string; impact: HarnessImpactRecord }> {
  const { path: designPath, content } = await readDesignDoc(projectRoot, change);
  const existing = readHarnessImpactFromContent(content);
  const nextImpact: HarnessImpactRecord = {
    mode: input.mode,
    reason: input.reason,
    affectedCapabilities: existing?.affectedCapabilities ?? [],
    existingAssetCandidates: existing?.existingAssetCandidates ?? [],
    assetDecisions: existing?.assetDecisions ?? []
  };
  const updated = renderUpdatedHarnessImpact(content, nextImpact);
  await fs.writeFile(designPath, updated, "utf8");
  return { path: designPath, impact: nextImpact };
}

export async function writePlaywrightHarnessImpact(
  projectRoot: string,
  change: string,
  input: { mode: HarnessImpactMode; reason: string }
): Promise<{ path: string; impact: PlaywrightHarnessImpactRecord }> {
  const { path: designPath, content } = await readDesignDoc(projectRoot, change);
  const existing = readPlaywrightHarnessImpactFromContent(content);
  const nextImpact: PlaywrightHarnessImpactRecord = {
    mode: input.mode,
    reason: input.reason,
    affectedCapabilities: existing?.affectedCapabilities ?? [],
    existingPlaywrightAssets: existing?.existingPlaywrightAssets ?? [],
    preliminaryDecision: existing?.preliminaryDecision ?? "none"
  };
  const updated = replaceOrAppendMarkdownSection(
    content,
    "Harness Playwright Impact",
    renderPlaywrightHarnessImpact(nextImpact)
  );
  await fs.writeFile(designPath, updated, "utf8");
  return { path: designPath, impact: nextImpact };
}

export async function seedHarnessImpact(
  projectRoot: string,
  change: string,
  input: HarnessImpactSeedInput
): Promise<{ path: string; impact: HarnessImpactRecord }> {
  const { path: designPath, content } = await readDesignDoc(projectRoot, change);
  const existing = readHarnessImpactFromContent(content);
  if (!existing) {
    throw new HarnessError({
      code: "COMET_DOC_SECTION_MISSING",
      category: "config",
      message: "Missing section: Harness Impact",
      path: designPath
    });
  }

  const nextImpact: HarnessImpactRecord = {
    ...existing,
    affectedCapabilities: input.affectedCapabilities ?? existing.affectedCapabilities,
    existingAssetCandidates: input.existingAssetCandidates ?? existing.existingAssetCandidates,
    assetDecisions: input.assetDecisions ?? existing.assetDecisions
  };
  const updated = renderUpdatedHarnessImpact(content, nextImpact);
  await fs.writeFile(designPath, updated, "utf8");
  return { path: designPath, impact: nextImpact };
}

export async function seedHarnessDesign(
  projectRoot: string,
  change: string,
  input: HarnessDesignSeedInput
): Promise<{ path: string; content: string }> {
  const { path: designPath, content } = await readDesignDoc(projectRoot, change);
  const updated = replaceOrAppendMarkdownSection(content, "Harness Design", renderHarnessDesign(input));
  await fs.writeFile(designPath, updated, "utf8");
  return { path: designPath, content: updated };
}

export async function readPlaywrightHarnessImpact(
  projectRoot: string,
  change: string
): Promise<{ path: string; impact: PlaywrightHarnessImpactRecord }> {
  const { path: designPath, content } = await readDesignDoc(projectRoot, change);
  const impact = readPlaywrightHarnessImpactFromContent(content);
  if (!impact) {
    throw new HarnessError({
      code: "COMET_DOC_SECTION_MISSING",
      category: "config",
      message: "Missing section: Harness Playwright Impact",
      path: designPath
    });
  }
  return { path: designPath, impact };
}

export function readPlaywrightHarnessDesignFromContent(
  content: string
): PlaywrightHarnessDesignRecord | null {
  const section = extractMarkdownSection(content, "Harness Playwright Design");
  if (!section.trim()) return null;
  return {
    mode: extractSingleBulletValue(section, "Mode") as HarnessImpactMode,
    decision: normalizePlaywrightDecision(extractSingleBulletValue(section, "Decision")),
    decisionReason: extractSingleBulletValue(section, "Decision Reason"),
    targetTests: extractStructuredEntries(extractBulletList(section, "Target tests")).map((entry) => ({
      path: entry.path ?? "",
      scenarioId: entry.scenarioId,
      action: normalizePlaywrightDecision(entry.action ?? ""),
      reason: entry.reason ?? ""
    })),
    relatedFiles: extractStructuredEntries(extractBulletList(section, "Related files")).map((entry) => ({
      path: entry.path ?? "",
      reason: entry.reason ?? ""
    })),
    verificationCommands: extractBulletList(section, "Verification commands")
  };
}

export async function readPlaywrightHarnessDesign(
  projectRoot: string,
  change: string
): Promise<{ path: string; design: PlaywrightHarnessDesignRecord }> {
  const { path: designPath, content } = await readDesignDoc(projectRoot, change);
  const design = readPlaywrightHarnessDesignFromContent(content);
  if (!design) {
    throw new HarnessError({
      code: "COMET_DOC_SECTION_MISSING",
      category: "config",
      message: "Missing section: Harness Playwright Design",
      path: designPath
    });
  }
  return { path: designPath, design };
}

export async function extractScenarioIdsFromDesign(
  projectRoot: string,
  change: string
): Promise<string[]> {
  const { path: designPath, content } = await readDesignDoc(projectRoot, change);

  const harnessDesign = extractMarkdownSection(content, "Harness Design");
  const scenarioIds = extractScenarioIdsFromHarnessDesign(harnessDesign);

  if (scenarioIds.length === 0) {
    throw new HarnessError({
      code: "COMET_SCENARIO_SELECTION_MISSING",
      category: "selection",
      message: `Harness Design does not declare any scenario IDs for ${change}`,
      path: designPath
    });
  }

  return [...new Set(scenarioIds)];
}

export async function extractPlaywrightTargetTestsFromDesign(
  projectRoot: string,
  change: string
): Promise<PlaywrightTargetTestRecord[]> {
  const { design } = await readPlaywrightHarnessDesign(projectRoot, change);
  return design.targetTests;
}

export function designDeclaresPlaywrightCreation(
  design: PlaywrightHarnessDesignRecord
): boolean {
  return (
    design.decision === "create" ||
    design.targetTests.some((target) => target.action === "create")
  );
}

export function extractPathsFromStructuredBullets(values: string[]): string[] {
  return extractStructuredEntries(values)
    .map((entry) => entry.path ?? "")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function extractMarkdownSection(content: string, heading: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) return "";
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) break;
    collected.push(lines[index]);
  }
  return collected.join("\n");
}

export function extractMarkdownSubsection(section: string, heading: string): string {
  const lines = section.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `### ${heading}`);
  if (start === -1) return "";
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("### ")) break;
    collected.push(lines[index]);
  }
  return collected.join("\n");
}

export function extractSingleBulletValue(section: string, label: string): string {
  for (const line of section.split(/\r?\n/)) {
    const trimmed = line.trim();
    const prefix = `- ${label}:`;
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim();
    }
  }
  return "";
}

export function extractBulletList(section: string, label: string): string[] {
  const lines = section.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() === `- ${label}:`);
  if (headerIndex === -1) return [];

  const values: string[] = [];
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("- ") && !rawLine.startsWith("  ")) break;
    if (trimmed.startsWith("- ")) {
      values.push(trimmed.slice(2).trim());
    }
  }
  return values;
}

function extractScenarioIdsFromHarnessDesign(harnessDesign: string): string[] {
  const mappingBlock = extractMarkdownSubsection(harnessDesign, "Scenario Mapping");
  const mappingIds = mappingBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
  if (mappingIds.length > 0) return mappingIds;

  const tableBlock = extractMarkdownSubsection(harnessDesign, "Asset Decision Table");
  const tableIds = parseAssetDecisionTable(tableBlock)
    .filter((row) => row.assetType === "scenario" && row.decision !== "none" && row.decision !== "deprecate")
    .map((row) => row.assetId);
  if (tableIds.length > 0) return tableIds;

  const scenarioDecisionBlock = extractMarkdownSubsection(harnessDesign, "Scenario Decision");
  return scenarioDecisionBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .flatMap((line) => line.match(/[a-z0-9-]{3,80}/g) ?? [])
    .filter((value) => value !== "reuse" && value !== "update" && value !== "extend" && value !== "create" && value !== "deprecate");
}

export interface AssetDecisionRow {
  assetType: string;
  assetId: string;
  decision: string;
  reason: string;
  contractChange: string;
  evidence: string;
}

export function parseAssetDecisionTable(section: string): AssetDecisionRow[] {
  const rows = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && !/^(\|\s*-+\s*)+\|?$/.test(line));
  if (rows.length <= 1) return [];

  return rows
    .slice(1)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 6)
    .map((cells) => ({
      assetType: cells[0],
      assetId: cells[1],
      decision: cells[2],
      reason: cells[3],
      contractChange: cells[4],
      evidence: cells[5]
    }));
}

function renderHarnessImpact(impact: HarnessImpactRecord): string {
  const lines = [
    "## Harness Impact",
    "",
    `- Mode: ${impact.mode}`,
    `- Reason: ${impact.reason}`,
    "- Affected capabilities:",
    ...renderIndentedBulletList(impact.affectedCapabilities),
    "- Existing asset candidates:",
    ...renderIndentedBulletList(impact.existingAssetCandidates),
    "- Asset decisions:",
    ...renderIndentedBulletList(impact.assetDecisions)
  ];
  return lines.join("\n");
}

function renderPlaywrightHarnessImpact(impact: PlaywrightHarnessImpactRecord): string {
  const lines = [
    "## Harness Playwright Impact",
    "",
    `- Mode: ${impact.mode}`,
    `- Reason: ${impact.reason}`,
    "- Affected capabilities:",
    ...renderIndentedBulletList(impact.affectedCapabilities),
    "- Existing Playwright assets:",
    ...renderIndentedBulletList(impact.existingPlaywrightAssets),
    `- Preliminary decision: ${impact.preliminaryDecision}`
  ];
  return lines.join("\n");
}

function renderUpdatedHarnessImpact(content: string, impact: HarnessImpactRecord): string {
  return replaceOrAppendMarkdownSection(content, "Harness Impact", renderHarnessImpact(impact));
}

function renderHarnessDesign(input: HarnessDesignSeedInput): string {
  const tableRows = [
    "| assetType | assetId | decision | reason | contractChange | evidence |",
    "| --------- | ------- | -------- | ------ | -------------- | -------- |",
    ...input.scenarioRows.map(
      (row) =>
        `| scenario | ${row.assetId} | ${row.decision} | ${row.reason} | ${row.contractChange} | ${row.evidence} |`
    ),
    ...input.fixtureRows.map(
      (row) =>
        `| fixture | ${row.assetId} | ${row.decision} | ${row.reason} | ${row.contractChange} | ${row.evidence} |`
    )
  ];

  const lines = [
    "## Harness Design",
    "",
    "### Impact Mode",
    "",
    `- Mode: ${input.mode}`,
    `- Reason: ${input.reason}`,
    "",
    "### Asset Decision Table",
    "",
    ...tableRows,
    "",
    "### Scenario Decision",
    ...renderIndentedBulletList(input.scenarioRows.map((row) => `${row.decision} ${row.assetId}`)),
    "",
    "### Fixture Decision",
    ...renderIndentedBulletList(input.fixtureRows.map((row) => `${row.decision} ${row.assetId}`)),
    "",
    "### Adapter Decision",
    ...renderIndentedBulletList(input.adapterDecisions),
    "",
    "### Oracle Decision",
    ...renderIndentedBulletList(input.oracleDecisions)
  ];
  return lines.join("\n");
}

function renderIndentedBulletList(values: string[]): string[] {
  if (values.length === 0) return ["  - none"];
  return values.map((value) => `  - ${value}`);
}

function replaceOrAppendMarkdownSection(content: string, heading: string, replacement: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) {
    const trimmed = content.trimEnd();
    return trimmed ? `${trimmed}\n\n${replacement}\n` : `${replacement}\n`;
  }

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      end = index;
      break;
    }
  }

  const before = lines.slice(0, start).join("\n").trimEnd();
  const after = lines.slice(end).join("\n").trimStart();
  if (before && after) return `${before}\n\n${replacement}\n\n${after}\n`;
  if (before) return `${before}\n\n${replacement}\n`;
  if (after) return `${replacement}\n\n${after}\n`;
  return `${replacement}\n`;
}

function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf(":");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const rawValue = trimmed.slice(separator + 1).trim();
    result[key] = stripQuotes(rawValue);
  }
  return result;
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function extractStructuredEntries(values: string[]): Array<Record<string, string>> {
  return values.map((value) =>
    Object.fromEntries(
      value
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const separator = part.indexOf(":");
          if (separator < 0) return [part, ""];
          return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
        })
    )
  );
}
