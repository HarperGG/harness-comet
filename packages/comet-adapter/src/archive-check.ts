import fs from "node:fs/promises";
import path from "node:path";
import {
  discoverHarnessAssets,
  discoverPlaywrightHarnessAssets,
  HarnessError,
  loadHarnessCometConfig,
  loadHarnessConfig
} from "@harness-comet/core";
import {
  readChangeCometYaml,
  extractPlaywrightTargetTestsFromDesign,
  extractScenarioIdsFromDesign,
  readHarnessImpact,
  readPlaywrightHarnessImpact,
  resolveChangeRoot
} from "./change.js";
import {
  buildVerificationFingerprint,
  buildVerificationFingerprintForMode,
  buildVerificationReportPath,
  readPlaywrightVerifyReceipt,
  readVerifyReceipt
} from "./verify.js";
import { resolveHarnessCometProjectMode } from "./project-mode.js";
import type { CometArchiveCheckReport } from "./types.js";

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
    const receipt = await readPlaywrightVerifyReceipt(
      path.join(resolveChangeRoot(projectRoot, change), ".comet", "harness", "verify-receipt.json")
    );
    if (receipt.action !== "none" || receipt.status !== "not-applicable") {
      throw new HarnessError({
        code: "COMET_ARCHIVE_RECEIPT_INVALID",
        category: "config",
        message: `Archive check requires a not-applicable verify receipt for ${change}`
      });
    }
    return {
      change,
      receiptPath: path.join(resolveChangeRoot(projectRoot, change), ".comet", "harness", "verify-receipt.json"),
      reportPath: buildVerificationReportPath(projectRoot, change),
      gitTreeHash: receipt.gitTreeHash,
      status: "passed"
    };
  }
  const changeRoot = resolveChangeRoot(projectRoot, change);
  const receiptPath = path.join(changeRoot, ".comet", "harness", "verify-receipt.json");
  const receipt = await readPlaywrightVerifyReceipt(receiptPath);
  const selectedScenarios = (await extractPlaywrightTargetTestsFromDesign(projectRoot, change)).map(
    (target) => target.path
  );
  const fingerprint = await buildVerificationFingerprintForMode(projectRoot, "playwright");
  if (
    receipt.status !== "passed" ||
    receipt.action !== impact.action ||
    receipt.gitTreeHash !== fingerprint.gitTreeHash ||
    receipt.configHash !== fingerprint.configHash ||
    receipt.assetHash !== fingerprint.assetHash ||
    JSON.stringify(receipt.targetTests) !==
      JSON.stringify(selectedScenarios.filter((target) => !target.endsWith(".retire")))
  ) {
    throw new HarnessError({
      code: "COMET_ARCHIVE_FINGERPRINT_MISMATCH",
      category: "config",
      message: `Archive check fingerprint mismatch for ${change}`
    });
  }
  const reportPath = buildVerificationReportPath(projectRoot, change);
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

async function projectHasHarnessAssets(projectRoot: string): Promise<boolean> {
  try {
    const config = await loadHarnessConfig({ root: projectRoot });
    const assets = await discoverHarnessAssets(config);
    return assets.scenarios.length + assets.fixtures.length > 0;
  } catch {
    return false;
  }
}

async function projectHasPlaywrightHarnessAssets(projectRoot: string): Promise<boolean> {
  try {
    const project = await loadHarnessCometConfig({ root: projectRoot });
    if (project.config.mode !== "playwright") return false;
    const assets = await discoverPlaywrightHarnessAssets({
      root: projectRoot,
      testDir: project.config.playwright.testDir,
      testMatch: project.config.playwright.testMatch
    });
    return assets.tests.some((asset) => asset.scenarios.length > 0);
  } catch {
    return false;
  }
}
