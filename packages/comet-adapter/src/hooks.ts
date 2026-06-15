import fs from "node:fs/promises";
import path from "node:path";
import {
  discoverHarnessAssets,
  discoverPlaywrightHarnessAssets,
  loadHarnessCometConfig,
  loadHarnessConfig,
  validateHarnessProject,
  HarnessError
} from "@harness-comet/core";
import {
  ensureChangeRoot,
  extractScenarioIdsFromDesign,
  parseAssetDecisionTable,
  type PlaywrightHarnessAction,
  type PlaywrightHarnessDesignRecord,
  type PlaywrightHarnessImpactRecord,
  type PlaywrightTargetOperation,
  readHarnessImpact,
  readPlaywrightHarnessDesign,
  readPlaywrightHarnessImpact,
  resolveDesignDocPath,
  extractPathsFromStructuredBullets
} from "./change.js";
import { classifyPlaywrightAssetPath } from "./playwright-impact-policy.js";
import { resolveHarnessCometProjectMode } from "./project-mode.js";

export interface CometHookReport {
  hook: "open" | "design" | "build";
  change: string;
  status: "passed";
}

export async function runCometOpenHook(
  projectRoot: string,
  change: string
): Promise<CometHookReport> {
  const mode = await resolveHarnessCometProjectMode(projectRoot);
  if (mode === "playwright") {
    return runCometPlaywrightOpenHook(projectRoot, change);
  }
  const changeRoot = await ensureChangeRoot(projectRoot, change);
  const tasksPath = path.join(changeRoot, "tasks.md");
  const tasks = await readRequiredFile(tasksPath, "COMET_OPEN_TASKS_MISSING", "Open tasks doc not found");
  const { path: designPath, impact } = await readHarnessImpact(projectRoot, change);

  if (!impact.reason) {
    throw new HarnessError({
      code: "COMET_OPEN_REASON_MISSING",
      category: "config",
      message: `Harness Impact reason is required for ${change}`,
      path: designPath
    });
  }

  if (impact.mode === "full" || impact.mode === "maintain") {
    if (impact.affectedCapabilities.length === 0) {
      throw new HarnessError({
        code: "COMET_OPEN_CAPABILITIES_MISSING",
        category: "config",
        message: `Harness Impact must declare affected capabilities for ${change}`,
        path: designPath
      });
    }
    if (impact.existingAssetCandidates.length === 0) {
      throw new HarnessError({
        code: "COMET_OPEN_CANDIDATES_MISSING",
        category: "config",
        message: `Harness Impact must declare existing asset candidates for ${change}`,
        path: designPath
      });
    }
    if (impact.assetDecisions.length === 0) {
      throw new HarnessError({
        code: "COMET_OPEN_DECISIONS_MISSING",
        category: "config",
        message: `Harness Impact must declare asset decisions for ${change}`,
        path: designPath
      });
    }
    if (!/harness/i.test(tasks)) {
      throw new HarnessError({
        code: "COMET_OPEN_TASKS_INVALID",
        category: "config",
        message: `Harness tasks are required in tasks.md for ${change}`,
        path: tasksPath
      });
    }
  }

  if (impact.mode === "maintain" && containsCreateDecision(impact.assetDecisions)) {
    throw new HarnessError({
      code: "COMET_OPEN_MAINTAIN_CREATE_INVALID",
      category: "config",
      message: `Harness Impact mode maintain cannot declare create decisions for ${change}`,
      path: designPath
    });
  }
  if (impact.mode === "off" && (await projectHasHarnessAssets(projectRoot))) {
    throw new HarnessError({
      code: "COMET_OPEN_OFF_INVALID",
      category: "config",
      message: `Harness Impact mode off is not allowed for an onboarded Harness project: ${change}`,
      path: designPath
    });
  }

  return { hook: "open", change, status: "passed" };
}

export async function runCometDesignHook(
  projectRoot: string,
  change: string
): Promise<CometHookReport> {
  const mode = await resolveHarnessCometProjectMode(projectRoot);
  if (mode === "playwright") {
    return runCometPlaywrightDesignHook(projectRoot, change);
  }
  const designPath = await resolveDesignDocPath(projectRoot, change);
  const design = await readRequiredFile(
    designPath,
    "COMET_DESIGN_DOC_MISSING",
    "Design hook design doc not found"
  );
  const { impact } = await readHarnessImpact(projectRoot, change);
  if (impact.mode === "off") {
    return { hook: "design", change, status: "passed" };
  }

  const harnessDesign = extractSection(design, "Harness Design");
  const impactModeSection = requireNonEmptySubsection(harnessDesign, "Impact Mode", designPath, change);
  const designMode = extractBulletValue(impactModeSection, "Mode");
  if (designMode !== impact.mode) {
    throw new HarnessError({
      code: "COMET_DESIGN_MODE_MISMATCH",
      category: "config",
      message: `Harness Design mode must match Harness Impact mode for ${change}`,
      path: designPath
    });
  }

  const decisionTable = requireNonEmptySubsection(harnessDesign, "Asset Decision Table", designPath, change);
  const decisionRows = parseAssetDecisionTable(decisionTable);
  if (decisionRows.length === 0) {
    throw new HarnessError({
      code: "COMET_DESIGN_DECISION_TABLE_INVALID",
      category: "config",
      message: `Harness Design Asset Decision Table must declare at least one row for ${change}`,
      path: designPath
    });
  }

  for (const row of decisionRows) {
    if (!ALLOWED_DECISIONS.has(row.decision)) {
      throw new HarnessError({
        code: "COMET_DESIGN_DECISION_INVALID",
        category: "config",
        message: `Unsupported Harness asset decision: ${row.decision} for ${change}`,
        path: designPath
      });
    }
    if (impact.mode === "maintain" && row.decision === "create") {
      throw new HarnessError({
        code: "COMET_DESIGN_MAINTAIN_CREATE_INVALID",
        category: "config",
        message: `Harness Design mode maintain cannot use create decisions for ${change}`,
        path: designPath
      });
    }
    validateDecisionEvidence(row, designPath, change);
  }

  requireNonEmptySubsection(harnessDesign, "Scenario Decision", designPath, change);
  const fixtureDecisionSection = requireNonEmptySubsection(harnessDesign, "Fixture Decision", designPath, change);
  requireNonEmptySubsection(harnessDesign, "Adapter Decision", designPath, change);
  requireNonEmptySubsection(harnessDesign, "Oracle Decision", designPath, change);

  await validateSharedFixtureConsumerNotes(projectRoot, decisionRows, fixtureDecisionSection, designPath, change);
  return { hook: "design", change, status: "passed" };
}

export async function runCometBuildHook(
  projectRoot: string,
  change: string
): Promise<CometHookReport> {
  const mode = await resolveHarnessCometProjectMode(projectRoot);
  if (mode === "playwright") {
    return runCometPlaywrightBuildHook(projectRoot, change);
  }
  const config = await loadHarnessConfig({ root: projectRoot });
  const designPath = await resolveDesignDocPath(projectRoot, change);
  const design = await readRequiredFile(
    designPath,
    "COMET_DESIGN_DOC_MISSING",
    "Build hook design doc not found"
  );
  const harnessDesign = extractSection(design, "Harness Design");
  const fixtureDecisionSection = requireNonEmptySubsection(harnessDesign, "Fixture Decision", designPath, change);
  const decisionTable = requireNonEmptySubsection(harnessDesign, "Asset Decision Table", designPath, change);
  const decisionRows = parseAssetDecisionTable(decisionTable);
  const selectedScenarioIds = await extractScenarioIdsFromDesign(projectRoot, change);
  const validation = await validateHarnessProject(config, { scenarioIds: selectedScenarioIds });
  if (!validation.ok) {
    throw validation.errors[0];
  }

  const assets = await discoverHarnessAssets(config);
  const discoveredIds = new Set(assets.scenarios.map((asset) => asset.scenario.id));
  for (const id of selectedScenarioIds) {
    if (!discoveredIds.has(id)) {
      throw new HarnessError({
        code: "COMET_BUILD_SCENARIO_MISSING",
        category: "selection",
        message: `Design-declared scenario not found: ${id}`
      });
    }
  }
  await validateSharedFixtureConsumerNotes(projectRoot, decisionRows, fixtureDecisionSection, designPath, change);

  const planRoot = path.join(projectRoot, "docs", "superpowers", "plans");
  const planContent = await readAllMarkdown(planRoot);
  for (const requiredLine of [
    "Scenario implementation",
    "Fixture implementation",
    "Adapter Action implementation",
    "Inspector implementation",
    "Oracle implementation",
    "Harness validation",
    "Harness scenario execution"
  ]) {
    if (!planContent.includes(requiredLine)) {
      throw new HarnessError({
        code: "COMET_BUILD_PLAN_INVALID",
        category: "config",
        message: `Build hook requires plan coverage for: ${requiredLine}`
      });
    }
  }

  return { hook: "build", change, status: "passed" };
}

async function runCometPlaywrightOpenHook(
  projectRoot: string,
  change: string
): Promise<CometHookReport> {
  const changeRoot = await ensureChangeRoot(projectRoot, change);
  const tasksPath = path.join(changeRoot, "tasks.md");
  const tasks = await readRequiredFile(tasksPath, "COMET_OPEN_TASKS_MISSING", "Open tasks doc not found");
  const { path: designPath, impact } = await readPlaywrightHarnessImpact(projectRoot, change);

  if (!impact.reason) {
    throw new HarnessError({
      code: "COMET_OPEN_REASON_MISSING",
      category: "config",
      message: `Harness Playwright Impact reason is required for ${change}`,
      path: designPath
    });
  }
  if (!["none", "verify-existing", "update-or-create"].includes(impact.action)) {
    throw new HarnessError({
      code: "COMET_OPEN_DECISIONS_MISSING",
      category: "config",
      message: `Harness Playwright Impact action is required for ${change}`,
      path: designPath
    });
  }
  if (!["user", "agent"].includes(impact.confirmedBy)) {
    throw new HarnessError({
      code: "COMET_OPEN_CONFIRMED_BY_INVALID",
      category: "config",
      message: `Harness Playwright Impact confirmed by is required for ${change}`,
      path: designPath
    });
  }
  if (impact.confirmedAt && Number.isNaN(Date.parse(impact.confirmedAt))) {
    throw new HarnessError({
      code: "COMET_OPEN_CONFIRMED_AT_INVALID",
      category: "config",
      message: `Harness Playwright Impact confirmed at must be an ISO timestamp for ${change}`,
      path: designPath
    });
  }
  if (!/harness/i.test(tasks)) {
    throw new HarnessError({
      code: "COMET_OPEN_TASKS_INVALID",
      category: "config",
      message: `Harness tasks are required in tasks.md for ${change}`,
      path: tasksPath
    });
  }
  return { hook: "open", change, status: "passed" };
}

async function runCometPlaywrightDesignHook(
  projectRoot: string,
  change: string
): Promise<CometHookReport> {
  const { path: designPath, impact } = await readPlaywrightHarnessImpact(projectRoot, change);
  const { design } = await readPlaywrightHarnessDesign(projectRoot, change);
  if (design.action !== impact.action) {
    throw new HarnessError({
      code: "COMET_DESIGN_MODE_MISMATCH",
      category: "config",
      message: `Harness Playwright Plan action must match Harness Playwright Impact action for ${change}`,
      path: designPath
    });
  }
  const project = await loadHarnessCometConfig({ root: projectRoot });
  if (project.config.mode !== "playwright") {
    throw new HarnessError({
      code: "COMET_BUILD_MODE_INVALID",
      category: "config",
      message: `Playwright design hook requires mode=playwright for ${change}`,
      path: designPath
    });
  }
  await validatePlaywrightPlanTargets(
    projectRoot,
    project.config.playwright.testDir,
    designPath,
    impact,
    design
  );
  return { hook: "design", change, status: "passed" };
}

async function runCometPlaywrightBuildHook(
  projectRoot: string,
  change: string
): Promise<CometHookReport> {
  const { impact } = await readPlaywrightHarnessImpact(projectRoot, change);
  const { path: designPath, design } = await readPlaywrightHarnessDesign(projectRoot, change);
  const project = await loadHarnessCometConfig({ root: projectRoot });
  if (project.config.mode !== "playwright") {
    throw new HarnessError({
      code: "COMET_BUILD_MODE_INVALID",
      category: "config",
      message: `Playwright build hook requires mode=playwright for ${change}`,
      path: designPath
    });
  }
  const assets = await discoverPlaywrightHarnessAssets({
    root: projectRoot,
    testDir: project.config.playwright.testDir,
    testMatch: project.config.playwright.testMatch
  });
  const filesByPath = new Map(assets.tests.map((asset) => [normalizePath(asset.path), asset]));
  await validatePlaywrightPlanTargets(
    projectRoot,
    project.config.playwright.testDir,
    designPath,
    impact,
    design
  );
  const unauthorizedCreates = await findUnauthorizedPlaywrightCreates(projectRoot, impact, design);
  if (impact.action === "verify-existing" && unauthorizedCreates.length > 0) {
    throw new HarnessError({
      code: "COMET_BUILD_PLAYWRIGHT_MAINTAIN_CREATE_INVALID",
      category: "config",
      message: `Maintain mode cannot create new Playwright assets: ${unauthorizedCreates.join(", ")}`,
      path: designPath
    });
  }
  if (impact.action === "none" && unauthorizedCreates.length > 0) {
    throw new HarnessError({
      code: "COMET_BUILD_PLAYWRIGHT_OFF_INVALID",
      category: "config",
      message: `Off mode cannot create Playwright assets: ${unauthorizedCreates.join(", ")}`,
      path: designPath
    });
  }
  return { hook: "build", change, status: "passed" };
}

export async function findUnauthorizedPlaywrightCreates(
  projectRoot: string,
  impact: Pick<PlaywrightHarnessImpactRecord, "reviewedTests" | "action">,
  design: {
    targetTests: Array<{ path: string; operation: string }>;
    relatedFiles: Array<{ path: string }>;
  }
): Promise<string[]> {
  const existing = new Set(impact.reviewedTests.map(normalizeRelativePath));
  const implicated = [
    ...design.targetTests.map((target) => ({ path: target.path, action: target.operation })),
    ...design.relatedFiles.map((file) => ({ path: file.path, action: "" }))
  ];

  return implicated
    .map((entry) => ({
      relativePath: normalizeRelativePath(entry.path),
      action: entry.action,
      classification: classifyPlaywrightAssetPath(normalizeRelativePath(entry.path))
    }))
    .filter((entry) => entry.classification.managed)
    .filter((entry) => entry.classification.kind !== "config")
    .filter((entry) => !existing.has(entry.relativePath))
    .map((entry) => entry.relativePath);
}

async function validatePlaywrightPlanTargets(
  projectRoot: string,
  testDir: string,
  designPath: string,
  impact: Pick<PlaywrightHarnessImpactRecord, "action">,
  design: PlaywrightHarnessDesignRecord
): Promise<void> {
  if (impact.action === "none") {
    if (design.targetTests.length > 0) {
      throw new HarnessError({
        code: "COMET_DESIGN_OFF_INVALID",
        category: "config",
        message: "Harness Playwright Plan action none cannot declare target tests",
        path: designPath
      });
    }
    return;
  }

  if (design.targetTests.length === 0) {
    throw new HarnessError({
      code: "COMET_DESIGN_FIELD_MISSING",
      category: "config",
      message: `Harness Playwright Plan target tests are required`,
      path: designPath
    });
  }

  const allowed =
    impact.action === "verify-existing"
      ? new Set<PlaywrightTargetOperation>(["verify", "update"])
      : new Set<PlaywrightTargetOperation>(["verify", "update", "create", "retire"]);

  for (const target of design.targetTests) {
    if (!allowed.has(target.operation)) {
      throw new HarnessError({
        code: "COMET_DESIGN_PLAYWRIGHT_DECISION_INVALID",
        category: "config",
        message: `Target operation ${target.operation} is not allowed for action ${impact.action}`,
        path: designPath
      });
    }
    if (!target.reason) {
      throw new HarnessError({
        code: "COMET_DESIGN_FIELD_MISSING",
        category: "config",
        message: `Each target test must include a reason`,
        path: designPath
      });
    }
    if (!isPathInsideTestDir(projectRoot, testDir, target.path)) {
      throw new HarnessError({
        code: "COMET_DESIGN_FIELD_MISSING",
        category: "config",
        message: `Target test must stay within ${testDir}: ${target.path}`,
        path: designPath
      });
    }
    if (
      target.operation !== "create" &&
      !(await fsExists(path.resolve(projectRoot, target.path)))
    ) {
      throw new HarnessError({
        code: "COMET_BUILD_SCENARIO_MISSING",
        category: "selection",
        message: `Design-declared Playwright test not found: ${target.path}`,
        path: designPath
      });
    }
  }
}

async function readRequiredFile(filePath: string, code: string, message: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    throw new HarnessError({
      code,
      category: "config",
      message,
      path: filePath
    });
  }
}

function extractSection(content: string, heading: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) {
    throw new HarnessError({
      code: "COMET_DOC_SECTION_MISSING",
      category: "config",
      message: `Missing section: ${heading}`
    });
  }
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) break;
    collected.push(lines[index]);
  }
  return collected.join("\n");
}

function extractBulletValue(section: string, label: string): string {
  for (const line of section.split(/\r?\n/)) {
    const trimmed = line.trim();
    const prefix = `- ${label}:`;
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim();
    }
  }
  return "";
}

function requireNonEmptySubsection(
  section: string,
  heading: string,
  filePath: string,
  change: string
): string {
  const lines = section.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `### ${heading}`);
  const collected: string[] = [];
  if (start !== -1) {
    for (let index = start + 1; index < lines.length; index += 1) {
      if (lines[index].startsWith("### ")) break;
      collected.push(lines[index]);
    }
  }
  const block = collected.join("\n").trim();
  if (!block) {
    throw new HarnessError({
      code: "COMET_DESIGN_FIELD_MISSING",
      category: "config",
      message: `Harness Design field is required: ${heading} for ${change}`,
      path: filePath
    });
  }
  return block;
}

const ALLOWED_DECISIONS = new Set(["reuse", "update", "extend", "create", "deprecate", "none"]);
const GENERIC_EVIDENCE = new Set(["", "none", "impact-analyze", "pending", "pending-review", "review"]);

function containsCreateDecision(values: string[]): boolean {
  return values.some((value) => /\bcreate\b/i.test(value));
}

async function fsExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isPathInsideTestDir(projectRoot: string, testDir: string, candidatePath: string): boolean {
  if (path.isAbsolute(candidatePath)) return false;
  const resolvedTestDir = path.resolve(projectRoot, testDir);
  const resolvedCandidate = path.resolve(projectRoot, candidatePath);
  const relative = path.relative(resolvedTestDir, resolvedCandidate);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

function normalizeRelativePath(filePath: string): string {
  return normalizePath(filePath).replace(/^\.\//, "");
}

function validateDecisionEvidence(
  row: ReturnType<typeof parseAssetDecisionTable>[number],
  filePath: string,
  change: string
): void {
  const normalizedEvidence = row.evidence.trim().toLowerCase().replace(/\s+/g, "-");
  const contractChanged = row.contractChange.trim().toLowerCase() === "yes";
  if (contractChanged && GENERIC_EVIDENCE.has(normalizedEvidence)) {
    throw new HarnessError({
      code: "COMET_DESIGN_EVIDENCE_MISSING",
      category: "config",
      message: `Harness Design requires concrete evidence for contract-changing decision ${row.assetType}:${row.assetId} in ${change}`,
      path: filePath
    });
  }
}

async function readAllMarkdown(root: string): Promise<string> {
  let result = "";
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        result += await readAllMarkdown(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        result += `\n${await fs.readFile(fullPath, "utf8")}`;
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return result;
}

async function projectHasHarnessAssets(projectRoot: string): Promise<boolean> {
  try {
    const project = await loadHarnessCometConfig({ root: projectRoot });
    if (project.config.mode === "playwright") {
      const assets = await discoverPlaywrightHarnessAssets({
        root: projectRoot,
        testDir: project.config.playwright.testDir,
        testMatch: project.config.playwright.testMatch
      });
      return assets.tests.some((asset) => asset.scenarios.length > 0);
    }
    const config = await loadHarnessConfig({ root: projectRoot });
    const assets = await discoverHarnessAssets(config);
    return assets.scenarios.length + assets.fixtures.length > 0;
  } catch {
    return false;
  }
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

async function validateSharedFixtureConsumerNotes(
  projectRoot: string,
  decisionRows: ReturnType<typeof parseAssetDecisionTable>,
  fixtureDecisionSection: string,
  designPath: string,
  change: string
): Promise<void> {
  const fixtureRows = decisionRows.filter(
    (row) => row.assetType === "fixture" && (row.decision === "update" || row.decision === "extend")
  );
  if (fixtureRows.length === 0) return;

  let config;
  try {
    config = await loadHarnessConfig({ root: projectRoot });
  } catch {
    return;
  }
  const assets = await discoverHarnessAssets(config);
  const fixtureAssets = new Map(assets.fixtures.map((asset) => [asset.fixture.id, asset.fixture]));

  for (const row of fixtureRows) {
    const fixture = fixtureAssets.get(row.assetId);
    if (!fixture || fixture.business?.scope !== "shared") continue;
    const consumers = fixture.business.consumers ?? [];
    if (consumers.length <= 1) continue;
    const missing = consumers.filter((consumer) => !fixtureDecisionSection.includes(consumer));
    if (missing.length > 0) {
      throw new HarnessError({
        code: "COMET_DESIGN_FIXTURE_CONSUMERS_MISSING",
        category: "config",
        message: `Shared fixture consumer impact must be documented for ${row.assetId}: ${missing.join(", ")} (${change})`,
        path: designPath
      });
    }
  }
}
