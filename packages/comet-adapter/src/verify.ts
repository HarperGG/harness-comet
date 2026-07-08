import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import {
  HarnessPlaywrightResultsV1Schema,
  PlaywrightVerifyReceiptV2Schema,
  type HarnessPlaywrightResultsV1
} from "@hapergg/harness-comet-schema";
import {
  discoverHarnessAssets,
  loadHarnessCometConfig,
  loadHarnessConfig,
  mapErrorToExitCode,
  runHarness,
  runPlaywrightHarness,
  HarnessError
} from "@hapergg/harness-comet-core";
import { HARNESS_COMET_VERSION, sha256, writeFileAtomic } from "./manifest.js";
import { detectCometCli } from "./discovery/comet-cli.js";
import {
  extractPlaywrightTargetTestsFromDesign,
  extractScenarioIdsFromDesign,
  ensureChangeRoot,
  getRunnablePlaywrightTargets,
  readHarnessImpact,
  readPlaywrightHarnessDesign,
  readPlaywrightHarnessImpact
} from "./change.js";
import { findUnauthorizedPlaywrightCreates } from "./hooks.js";
import { resolveHarnessCometProjectMode } from "./project-mode.js";
import type { CometVerifyReport, PlaywrightVerifyReceiptV2, VerifyReceiptV1 } from "./types.js";

interface VerifyPlaywrightProjectConfig {
  root: string;
  playwright: {
    configFile: string;
    testDir: string;
    resultsFile: string;
  };
}

export async function verifyCometChange(
  projectRoot: string,
  change: string
): Promise<CometVerifyReport> {
  const mode = await resolveHarnessCometProjectMode(projectRoot);
  if (mode === "playwright") {
    return verifyPlaywrightCometChange(projectRoot, change);
  }
  const changeRoot = await ensureChangeRoot(projectRoot, change);
  const comet = await detectCometCli(projectRoot);
  const receiptPath = path.join(changeRoot, ".comet", "harness", "verify-receipt.json");
  const reportPath = buildVerificationReportPath(projectRoot, change);
  const { impact } = await readHarnessImpact(projectRoot, change);

  if (impact.mode === "off") {
    if (await projectHasHarnessAssets(projectRoot)) {
      throw new HarnessError({
        code: "COMET_VERIFY_OFF_INVALID",
        category: "config",
        message: `Harness Impact mode off is not allowed for an onboarded Harness project: ${change}`
      });
    }
    await writeVerificationSkipReport(reportPath, change, impact.reason);
    return {
      change,
      comet,
      receiptPath: "not-applicable",
      reportPath,
      reused: false,
      selectedScenarios: [],
      result: "passed",
      gitTreeHash: "not-applicable"
    };
  }

  const selectedScenarios = await extractScenarioIdsFromDesign(projectRoot, change);
  const { configHash, assetHash, gitTreeHash } = await buildVerificationFingerprint(projectRoot);

  const reusable = await readReusableVerifyReceipt(
    receiptPath,
    gitTreeHash,
    configHash,
    assetHash,
    selectedScenarios
  );
  if (reusable) {
    await writeVerificationReport(projectRoot, reportPath, reusable, true);
    return {
      change,
      comet,
      receiptPath,
      reportPath,
      reused: true,
      selectedScenarios,
      result: "passed",
      gitTreeHash
    };
  }

  let receipt: VerifyReceiptV1;
  try {
    const run = (await runHarness({
      root: projectRoot,
      scenarioIds: selectedScenarios
    })) as { status: string; completedAt: string };
    receipt = {
      schemaVersion: 1,
      change,
      harnessCometVersion: HARNESS_COMET_VERSION,
      cometVersion: comet.version ?? "unknown",
      gitTreeHash,
      configHash,
      assetHash,
      selectedScenarios,
      status: normalizeRunStatus(run.status),
      completedAt: run.completedAt
    };
    await writeReceipt(receiptPath, receipt);
    await writeVerificationReport(projectRoot, reportPath, receipt, false);
    return {
      change,
      comet,
      receiptPath,
      reportPath,
      reused: false,
      selectedScenarios,
      result: receipt.status,
      gitTreeHash
    };
  } catch (error) {
    const status = mapErrorToExitCode(error) === 1 ? "failed" : "error";
    receipt = {
      schemaVersion: 1,
      change,
      harnessCometVersion: HARNESS_COMET_VERSION,
      cometVersion: comet.version ?? "unknown",
      gitTreeHash,
      configHash,
      assetHash,
      selectedScenarios,
      status,
      completedAt: new Date().toISOString()
    };
    await writeReceipt(receiptPath, receipt);
    await writeVerificationReport(projectRoot, reportPath, receipt, false);
    throw error;
  }
}

async function verifyPlaywrightCometChange(
  projectRoot: string,
  change: string
): Promise<CometVerifyReport> {
  const changeRoot = await ensureChangeRoot(projectRoot, change);
  const comet = await detectCometCli(projectRoot);
  const receiptPath = path.join(changeRoot, ".comet", "harness", "verify-receipt.json");
  const reportPath = buildVerificationReportPath(projectRoot, change);
  const { impact } = await readPlaywrightHarnessImpact(projectRoot, change);
  const project = await loadPlaywrightProjectConfig(projectRoot);
  const resultsPath = path.join(project.root, project.playwright.resultsFile);
  const relativeResultsPath = path.relative(project.root, resultsPath) || project.playwright.resultsFile;
  const relativeReportPath = path.relative(project.root, reportPath) || reportPath;

  if (impact.action === "none") {
    const { configHash, assetHash, gitTreeHash } = await buildVerificationFingerprintForMode(
      projectRoot,
      "playwright"
    );
    const receipt: PlaywrightVerifyReceiptV2 = {
      schemaVersion: 2,
      change,
      action: impact.action,
      harnessCometVersion: HARNESS_COMET_VERSION,
      cometVersion: comet.version ?? "unknown",
      gitTreeHash,
      configHash,
      assetHash,
      targetTests: [],
      status: "not-applicable",
      resultsPath: "not-applicable",
      reportPath: relativeReportPath,
      evidenceCount: 0,
      completedAt: new Date().toISOString()
    };
    await writePlaywrightReceipt(receiptPath, receipt);
    await writePlaywrightVerificationReport(reportPath, receipt, impact.reason ?? "No action declared");
    return {
      change,
      comet,
      receiptPath,
      reportPath,
      reused: false,
      selectedScenarios: [],
      result: "not-applicable",
      gitTreeHash
    };
  }

  const { design } = await readPlaywrightHarnessDesign(projectRoot, change);
  const targetTests = await extractPlaywrightTargetTestsFromDesign(projectRoot, change);
  const unauthorizedCreates = await findUnauthorizedPlaywrightCreates(projectRoot, impact, design);
  if (impact.action === "verify-existing" && unauthorizedCreates.length > 0) {
    throw new HarnessError({
      code: "PLAYWRIGHT_CREATE_NOT_ALLOWED",
      category: "config",
      message: `Action verify-existing cannot create new Playwright assets: ${unauthorizedCreates.join(", ")}`,
      hint: "Change the Action to update-or-create or remove create operations."
    });
  }
  const runnableTargets = getRunnablePlaywrightTargets(targetTests);
  const selectedScenarios = runnableTargets.map((target) => target.path);
  const { configHash, assetHash, gitTreeHash } = await buildVerificationFingerprintForMode(
    projectRoot,
    "playwright"
  );
  const reusable = await readReusablePlaywrightReceipt(
    receiptPath,
    gitTreeHash,
    configHash,
    assetHash,
    selectedScenarios
  );
  if (reusable) {
    await writePlaywrightVerificationReport(reportPath, reusable, undefined, true);
    return {
      change,
      comet,
      receiptPath,
      reportPath,
      reused: true,
      selectedScenarios,
      result: reusable.status,
      gitTreeHash
    };
  }
  const code = await runPlaywrightHarness({
    root: project.root,
    configFile: project.playwright.configFile,
    args: runnableTargets.map((target) => target.path),
    env: {
      HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE: resultsPath,
      HARNESS_COMET_PLAYWRIGHT_PROJECT_ROOT: project.root
    }
  });
  try {
    await fs.access(resultsPath);
  } catch {
    throw new HarnessError({
      code: "COMET_VERIFY_PLAYWRIGHT_REPORTER_MISSING",
      category: "playwright",
      message: `Playwright results file was not produced for ${change}`,
      hint: `Ensure playwright.config registers "@hapergg/harness-comet-playwright/reporter" and rerun comet verify`,
      path: resultsPath
    });
  }
  const results = await readPlaywrightResults(resultsPath);
  assertDeclaredTargetsCovered(runnableTargets.map((target) => target.path), results);
  const derivedStatus = derivePlaywrightVerifyStatus(results);
  const status: PlaywrightVerifyReceiptV2["status"] =
    code !== 0 && derivedStatus === "passed" ? "failed" : derivedStatus;
  const receipt: PlaywrightVerifyReceiptV2 = {
    schemaVersion: 2,
    change,
    action: impact.action,
    harnessCometVersion: HARNESS_COMET_VERSION,
    cometVersion: comet.version ?? "unknown",
    gitTreeHash,
    configHash,
    assetHash,
    targetTests: selectedScenarios,
    status,
    resultsPath: relativeResultsPath,
    reportPath: relativeReportPath,
    evidenceCount: countPlaywrightEvidence(results),
    completedAt: new Date().toISOString()
  };
  await writePlaywrightReceipt(receiptPath, receipt);
  await writePlaywrightVerificationReport(reportPath, receipt);
  if (status !== "passed") {
    throw new HarnessError({
      code: "COMET_VERIFY_PLAYWRIGHT_FAILED",
      category: "playwright",
      message: `Playwright verification failed for ${change}`,
      path: resultsPath
    });
  }
  return {
    change,
    comet,
    receiptPath,
    reportPath,
    reused: false,
    selectedScenarios,
    result: status,
    gitTreeHash
  };
}

async function loadPlaywrightProjectConfig(projectRoot: string): Promise<VerifyPlaywrightProjectConfig> {
  try {
    const project = await loadHarnessCometConfig({ root: projectRoot });
    if (project.config.mode !== "playwright") {
      throw new HarnessError({
        code: "COMET_VERIFY_MODE_INVALID",
        category: "config",
        message: "Expected mode=playwright"
      });
    }
    return {
      root: project.root,
      playwright: {
        configFile: project.config.playwright.configFile,
        testDir: project.config.playwright.testDir,
        resultsFile: project.config.playwright.resultsFile
      }
    };
  } catch (error) {
    if (error instanceof HarnessError && error.code !== "CONFIG_NOT_FOUND") throw error;
  }

  try {
    await fs.access(path.join(projectRoot, "playwright.config.ts"));
  } catch {
    throw new HarnessError({
      code: "CONFIG_NOT_FOUND",
      category: "config",
      message: "Missing harness-comet.config.ts or playwright.config.ts"
    });
  }

  return {
    root: projectRoot,
    playwright: {
      configFile: "playwright.config.ts",
      testDir: "tests",
      resultsFile: "test-results/harness-comet/results.json"
    }
  };
}

async function readReusableVerifyReceipt(
  receiptPath: string,
  gitTreeHash: string,
  configHash: string,
  assetHash: string,
  selectedScenarios: string[]
): Promise<VerifyReceiptV1 | undefined> {
  try {
    const parsed = JSON.parse(await fs.readFile(receiptPath, "utf8")) as VerifyReceiptV1;
    if (
      parsed.schemaVersion === 1 &&
      parsed.gitTreeHash === gitTreeHash &&
      parsed.configHash === configHash &&
      parsed.assetHash === assetHash &&
      JSON.stringify(parsed.selectedScenarios) === JSON.stringify(selectedScenarios) &&
      parsed.status === "passed"
    ) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function readReusablePlaywrightReceipt(
  receiptPath: string,
  gitTreeHash: string,
  configHash: string,
  assetHash: string,
  targetTests: string[]
): Promise<PlaywrightVerifyReceiptV2 | undefined> {
  try {
    const parsed = PlaywrightVerifyReceiptV2Schema.parse(
      JSON.parse(await fs.readFile(receiptPath, "utf8"))
    );
    if (
      parsed.gitTreeHash === gitTreeHash &&
      parsed.configHash === configHash &&
      parsed.assetHash === assetHash &&
      JSON.stringify(parsed.targetTests) === JSON.stringify(targetTests) &&
      parsed.status === "passed"
    ) {
      return parsed;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

async function buildVerificationFingerprint(projectRoot: string): Promise<{
  configHash: string;
  assetHash: string;
  gitTreeHash: string;
}> {
  const configPath = path.join(projectRoot, "harness-comet.config.ts");
  const configHash = await hashFileOrMissing(configPath);
  const assetHash = sha256(
    JSON.stringify(
      await Promise.all([
        hashDirectory(path.join(projectRoot, "harness")),
        hashDirectory(path.join(projectRoot, "docs", "testing"))
      ])
    )
  );
  return { configHash, assetHash, gitTreeHash: await gitTreeHash(projectRoot) };
}

async function buildVerificationFingerprintForMode(
  projectRoot: string,
  mode: "runtime" | "playwright"
): Promise<{
  configHash: string;
  assetHash: string;
  gitTreeHash: string;
}> {
  if (mode === "runtime") return buildVerificationFingerprint(projectRoot);
  const configHash = await hashFileOrMissing(path.join(projectRoot, "harness-comet.config.ts"));
  const assetHash = sha256(
    JSON.stringify(
      await Promise.all([
        hashFileOrMissing(path.join(projectRoot, "playwright.config.ts")),
        hashDirectory(path.join(projectRoot, "tests")),
        hashDirectory(path.join(projectRoot, "docs", "testing"))
      ])
    )
  );
  return { configHash, assetHash, gitTreeHash: await gitTreeHash(projectRoot) };
}

async function hashFileOrMissing(filePath: string): Promise<string> {
  try {
    return sha256(await fs.readFile(filePath, "utf8"));
  } catch {
    return "missing";
  }
}

async function hashDirectory(directory: string): Promise<Record<string, string>> {
  const files = await collectFiles(directory);
  const entries: Record<string, string> = {};
  for (const file of files) {
    entries[path.relative(directory, file)] = await hashFileOrMissing(file);
  }
  return entries;
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries: string[] = [];
  try {
    for (const dirent of await fs.readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, dirent.name);
      if (dirent.isDirectory()) entries.push(...(await collectFiles(full)));
      else if (dirent.isFile()) entries.push(full);
    }
  } catch {
    return [];
  }
  return entries.sort();
}

async function gitTreeHash(projectRoot: string): Promise<string> {
  try {
    const { stdout } = await execa("git", ["rev-parse", "HEAD^{tree}"], { cwd: projectRoot });
    return stdout.trim();
  } catch {
    return "no-git-tree";
  }
}

function normalizeRunStatus(value: string): VerifyReceiptV1["status"] {
  if (value === "passed" || value === "failed") return value;
  return "error";
}

async function projectHasHarnessAssets(projectRoot: string): Promise<boolean> {
  try {
    const config = await loadHarnessConfig({ root: projectRoot });
    const assets = await discoverHarnessAssets(config);
    return assets.scenarios.length > 0;
  } catch {
    return false;
  }
}

async function writeReceipt(filePath: string, receipt: VerifyReceiptV1): Promise<void> {
  await writeFileAtomic(filePath, `${JSON.stringify(receipt, null, 2)}\n`, 0o644);
}

async function writePlaywrightReceipt(
  filePath: string,
  receipt: PlaywrightVerifyReceiptV2
): Promise<void> {
  await writeFileAtomic(filePath, `${JSON.stringify(receipt, null, 2)}\n`, 0o644);
}

async function readPlaywrightResults(resultsPath: string): Promise<HarnessPlaywrightResultsV1> {
  return HarnessPlaywrightResultsV1Schema.parse(JSON.parse(await fs.readFile(resultsPath, "utf8")));
}

function derivePlaywrightVerifyStatus(
  results: HarnessPlaywrightResultsV1
): PlaywrightVerifyReceiptV2["status"] {
  if (results.tests.some((test) => test.status === "failed" || test.status === "timedOut")) {
    return "failed";
  }
  if (results.tests.some((test) => test.status === "interrupted")) return "error";
  return "passed";
}

function countPlaywrightEvidence(results: HarnessPlaywrightResultsV1): number {
  return results.tests.reduce((count, test) => count + test.attachments.length, 0);
}

function assertDeclaredTargetsCovered(targets: string[], results: HarnessPlaywrightResultsV1): void {
  const files = new Set(results.tests.map((test) => normalizePath(test.file)));
  const missing = targets.map(normalizePath).filter((target) => !files.has(target));
  if (missing.length > 0) {
    throw new HarnessError({
      code: "COMET_VERIFY_PLAYWRIGHT_TARGET_MISSING",
      category: "playwright",
      message: `Declared Playwright targets did not run: ${missing.join(", ")}`
    });
  }
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

async function writeVerificationReport(
  projectRoot: string,
  reportPath: string,
  receipt: VerifyReceiptV1,
  reused: boolean
): Promise<void> {
  const lines = [
    `# Harness Verification Report`,
    ``,
    `## Harness Verification`,
    ``,
    `- Change: ${receipt.change}`,
    `- Status: ${receipt.status}`,
    `- Reused receipt: ${reused}`,
    `- Receipt: \`openspec/changes/${receipt.change}/.comet/harness/verify-receipt.json\``,
    `- Git tree: ${receipt.gitTreeHash}`,
    `- Config hash: ${receipt.configHash}`,
    `- Asset hash: ${receipt.assetHash}`,
    `- Selected scenarios: ${receipt.selectedScenarios.join(", ") || "none"}`,
    ``
  ];
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
}

async function writePlaywrightVerificationReport(
  reportPath: string,
  receipt: PlaywrightVerifyReceiptV2,
  reason?: string,
  reused = false
): Promise<void> {
  const lines = [
    `# Harness Playwright Verification Report`,
    ``,
    `## Harness Playwright Verification`,
    ``,
    `- Change: ${receipt.change}`,
    `- Action: ${receipt.action}`,
    `- Status: ${receipt.status.toUpperCase()}`,
    `- Reused receipt: ${reused}`,
    `- Receipt: \`openspec/changes/${receipt.change}/.comet/harness/verify-receipt.json\``,
    `- Results: \`${receipt.resultsPath}\``,
    `- Results path: ${receipt.resultsPath}`,
    `- Git tree: ${receipt.gitTreeHash}`,
    `- Config hash: ${receipt.configHash}`,
    `- Asset hash: ${receipt.assetHash}`,
    `- Target tests: ${receipt.targetTests.join(", ") || "none"}`,
    `- Evidence count: ${receipt.evidenceCount}`,
    ...(reason ? [`- Reason: ${reason}`] : []),
    ``
  ];
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
}

async function writeVerificationSkipReport(
  reportPath: string,
  change: string,
  reason: string
): Promise<void> {
  const lines = [
    `# Harness Verification Report`,
    ``,
    `## Harness Verification`,
    ``,
    `- Change: ${change}`,
    `- Status: skipped`,
    `- Reason: ${reason}`,
    ``
  ];
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, `${lines.join("\n")}\n`, "utf8");
}

function buildVerificationReportPath(projectRoot: string, change: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(projectRoot, "docs", "superpowers", "reports", `${date}-${change}-harness.md`);
}
