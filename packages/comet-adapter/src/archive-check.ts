import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { PlaywrightVerifyReceiptV2Schema } from "@hapergg/harness-comet-schema";
import {
  discoverHarnessAssets,
  HarnessError,
  loadHarnessConfig
} from "@hapergg/harness-comet-core";
import {
  readChangeCometYaml,
  extractPlaywrightTargetTestsFromDesign,
  extractScenarioIdsFromDesign,
  getRunnablePlaywrightTargets,
  readHarnessImpact,
  readPlaywrightHarnessImpact,
  resolveChangeRoot
} from "./change.js";
import { sha256 } from "./manifest.js";
import { resolveHarnessCometProjectMode } from "./project-mode.js";
import type { CometArchiveCheckReport, PlaywrightVerifyReceiptV2, VerifyReceiptV1 } from "./types.js";

function resolveReceiptReportPath(projectRoot: string, reportPath: string): string {
  return path.isAbsolute(reportPath) ? reportPath : path.join(projectRoot, reportPath);
}

export async function archiveCheckCometChange(
  projectRoot: string,
  change: string
): Promise<CometArchiveCheckReport> {
  const mode = await resolveHarnessCometProjectMode(projectRoot);
  if (mode === "playwright") {
    return archiveCheckPlaywrightCometChange(projectRoot, change);
  }
  const { data } = await readChangeCometYaml(projectRoot, change);
  const { impact } = await readHarnessImpact(projectRoot, change);
  if (data.phase !== "archive") {
    throw new HarnessError({
      code: "COMET_ARCHIVE_PHASE_INVALID",
      category: "config",
      message: `Archive check requires phase=archive for ${change}`
    });
  }
  if (data.verify_result !== "pass") {
    throw new HarnessError({
      code: "COMET_ARCHIVE_VERIFY_RESULT_INVALID",
      category: "config",
      message: `Archive check requires verify_result=pass for ${change}`
    });
  }

  if (impact.mode === "off") {
    if (await projectHasHarnessAssets(projectRoot)) {
      throw new HarnessError({
        code: "COMET_ARCHIVE_OFF_INVALID",
        category: "config",
        message: `Harness Impact mode off is not allowed for an onboarded Harness project: ${change}`
      });
    }
    return {
      change,
      receiptPath: "not-applicable",
      reportPath: buildVerificationReportPath(projectRoot, change),
      gitTreeHash: "not-applicable",
      status: "passed"
    };
  }

  const changeRoot = resolveChangeRoot(projectRoot, change);
  const receiptPath = path.join(changeRoot, ".comet", "harness", "verify-receipt.json");
  const receipt = await readVerifyReceipt(receiptPath);
  if (receipt.status !== "passed") {
    throw new HarnessError({
      code: "COMET_ARCHIVE_RECEIPT_INVALID",
      category: "config",
      message: `Archive check requires a passed verify receipt for ${change}`,
      path: receiptPath
    });
  }

  const selectedScenarios = await extractScenarioIdsFromDesign(projectRoot, change);
  const fingerprint = await buildVerificationFingerprint(projectRoot);
  if (
    receipt.gitTreeHash !== fingerprint.gitTreeHash ||
    receipt.configHash !== fingerprint.configHash ||
    receipt.assetHash !== fingerprint.assetHash ||
    JSON.stringify(receipt.selectedScenarios) !== JSON.stringify(selectedScenarios)
  ) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_FINGERPRINT_MISMATCH",
      category: "config",
      message: `Archive check fingerprint mismatch for ${change}`
    });
  }

  const reportPath = buildVerificationReportPath(projectRoot, change);
  let report = "";
  try {
    report = await fs.readFile(reportPath, "utf8");
  } catch {
    throw new HarnessError({
      code: "COMET_ARCHIVE_REPORT_MISSING",
      category: "config",
      message: `Comet verification report missing for ${change}`,
      path: reportPath
    });
  }

  if (!report.includes("## Harness Verification")) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_REPORT_SECTION_MISSING",
      category: "config",
      message: `Comet verification report is missing the Harness Verification section for ${change}`,
      path: reportPath
    });
  }

  const expectedReceiptLine = `- Receipt: \`openspec/changes/${change}/.comet/harness/verify-receipt.json\``;
  if (!report.includes(expectedReceiptLine)) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_REPORT_RECEIPT_MISMATCH",
      category: "config",
      message: `Comet verification report receipt path mismatch for ${change}`,
      path: reportPath
    });
  }

  return {
    change,
    receiptPath,
    reportPath,
    gitTreeHash: fingerprint.gitTreeHash,
    status: "passed"
  };
}

async function archiveCheckPlaywrightCometChange(
  projectRoot: string,
  change: string
): Promise<CometArchiveCheckReport> {
  const { data } = await readChangeCometYaml(projectRoot, change);
  const { impact } = await readPlaywrightHarnessImpact(projectRoot, change);
  if (data.phase !== "archive") {
    throw new HarnessError({
      code: "COMET_ARCHIVE_PHASE_INVALID",
      category: "config",
      message: `Archive check requires phase=archive for ${change}`
    });
  }
  if (data.verify_result !== "pass") {
    throw new HarnessError({
      code: "COMET_ARCHIVE_VERIFY_RESULT_INVALID",
      category: "config",
      message: `Archive check requires verify_result=pass for ${change}`
    });
  }
  if (impact.action === "none") {
    const receiptPath = path.join(resolveChangeRoot(projectRoot, change), ".comet", "harness", "verify-receipt.json");
    const receipt = await readPlaywrightVerifyReceipt(receiptPath);
    if (receipt.action !== "none" || receipt.status !== "not-applicable") {
      throw new HarnessError({
        code: "COMET_ARCHIVE_RECEIPT_INVALID",
        category: "config",
        message: `Archive check requires a not-applicable verify receipt for ${change}`
      });
    }
    const fingerprint = await buildVerificationFingerprintForMode(projectRoot, "playwright");
    if (
      receipt.gitTreeHash !== fingerprint.gitTreeHash ||
      receipt.configHash !== fingerprint.configHash ||
      receipt.assetHash !== fingerprint.assetHash
    ) {
      throw new HarnessError({
        code: "COMET_ARCHIVE_FINGERPRINT_MISMATCH",
        category: "config",
        message: `Archive check fingerprint mismatch for ${change}`
      });
    }
    const reportPath = resolveReceiptReportPath(projectRoot, receipt.reportPath);
    const report = await fs.readFile(reportPath, "utf8");
    validatePlaywrightNoneArchiveReport(report, receipt, change, reportPath);
    return {
      change,
      receiptPath,
      reportPath,
      gitTreeHash: fingerprint.gitTreeHash,
      status: "passed"
    };
  }
  const changeRoot = resolveChangeRoot(projectRoot, change);
  const receiptPath = path.join(changeRoot, ".comet", "harness", "verify-receipt.json");
  const receipt = await readPlaywrightVerifyReceipt(receiptPath);
  const targetTests = await extractPlaywrightTargetTestsFromDesign(projectRoot, change);
  const selectedScenarios = getRunnablePlaywrightTargets(targetTests).map((target) => target.path);
  const fingerprint = await buildVerificationFingerprintForMode(projectRoot, "playwright");
  if (
    receipt.status !== "passed" ||
    receipt.action !== impact.action ||
    receipt.gitTreeHash !== fingerprint.gitTreeHash ||
    receipt.configHash !== fingerprint.configHash ||
    receipt.assetHash !== fingerprint.assetHash ||
    JSON.stringify(receipt.targetTests) !== JSON.stringify(selectedScenarios)
  ) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_FINGERPRINT_MISMATCH",
      category: "config",
      message: `Archive check fingerprint mismatch for ${change}`
    });
  }
  const reportPath = resolveReceiptReportPath(projectRoot, receipt.reportPath);
  const report = await fs.readFile(reportPath, "utf8");
  if (!report.includes("## Harness Playwright Verification")) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_REPORT_SECTION_MISSING",
      category: "config",
      message: `Comet verification report is missing the Harness Playwright Verification section for ${change}`,
      path: reportPath
    });
  }
  await fs.access(path.join(projectRoot, receipt.resultsPath));
  return {
    change,
    receiptPath,
    reportPath,
    gitTreeHash: fingerprint.gitTreeHash,
    status: "passed"
  };
}

function validatePlaywrightNoneArchiveReport(
  report: string,
  receipt: PlaywrightVerifyReceiptV2,
  change: string,
  reportPath: string
): void {
  if (!report.includes("## Harness Playwright Verification")) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_REPORT_SECTION_MISSING",
      category: "config",
      message: `Comet verification report is missing the Harness Playwright Verification section for ${change}`,
      path: reportPath
    });
  }
  if (!report.includes("- Action: none")) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_REPORT_ACTION_MISMATCH",
      category: "config",
      message: `Comet verification report action mismatch for ${change}`,
      path: reportPath
    });
  }
  if (!report.includes("- Status: NOT-APPLICABLE")) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_REPORT_STATUS_MISMATCH",
      category: "config",
      message: `Comet verification report status mismatch for ${change}`,
      path: reportPath
    });
  }
  const expectedReceiptLine = `- Receipt: \`openspec/changes/${change}/.comet/harness/verify-receipt.json\``;
  if (!report.includes(expectedReceiptLine)) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_REPORT_RECEIPT_MISMATCH",
      category: "config",
      message: `Comet verification report receipt path mismatch for ${change}`,
      path: reportPath
    });
  }
  if (receipt.targetTests.length !== 0) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_RECEIPT_INVALID",
      category: "config",
      message: `Archive check requires an empty targetTests list for ${change}`,
      path: reportPath
    });
  }
  if (receipt.resultsPath !== "not-applicable") {
    throw new HarnessError({
      code: "COMET_ARCHIVE_RECEIPT_INVALID",
      category: "config",
      message: `Archive check requires resultsPath=not-applicable for ${change}`,
      path: reportPath
    });
  }
  if (receipt.evidenceCount !== 0) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_RECEIPT_INVALID",
      category: "config",
      message: `Archive check requires evidenceCount=0 for ${change}`,
      path: reportPath
    });
  }
}

async function readVerifyReceipt(receiptPath: string): Promise<VerifyReceiptV1> {
  try {
    return JSON.parse(await fs.readFile(receiptPath, "utf8")) as VerifyReceiptV1;
  } catch (error) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_RECEIPT_MISSING",
      category: "config",
      message: `Comet verify receipt missing or invalid: ${receiptPath}`,
      path: receiptPath,
      context: { cause: error instanceof Error ? error.message : String(error) }
    });
  }
}

async function readPlaywrightVerifyReceipt(receiptPath: string): Promise<PlaywrightVerifyReceiptV2> {
  try {
    return PlaywrightVerifyReceiptV2Schema.parse(JSON.parse(await fs.readFile(receiptPath, "utf8")));
  } catch (error) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_RECEIPT_MISSING",
      category: "config",
      message: `Comet Playwright verify receipt missing or invalid: ${receiptPath}`,
      path: receiptPath,
      context: { cause: error instanceof Error ? error.message : String(error) }
    });
  }
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

function buildVerificationReportPath(projectRoot: string, change: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(projectRoot, "docs", "superpowers", "reports", `${date}-${change}-harness.md`);
}

async function projectHasHarnessAssets(projectRoot: string): Promise<boolean> {
  try {
    const config = await loadHarnessConfig({ root: projectRoot });
    const assets = await discoverHarnessAssets(config);
    return assets.scenarios.length + assets.fixtures.length > 0;
  } catch {
    return false;
  }
}
