import fs from "node:fs/promises";
import path from "node:path";
import { HarnessError } from "@hapergg/harness-comet-core";
import {
  extractPlaywrightTargetTestsFromDesign,
  getRunnablePlaywrightTargets,
  readChangeCometYaml,
  readPlaywrightHarnessImpact,
  resolveChangeRoot
} from "./change.js";
import { archiveCheckCometChange as archiveCheckLegacyCometChange } from "./archive-check.js";
import { matchesPlaywrightArchiveFingerprint } from "./playwright-archive-fingerprint.js";
import { resolveHarnessCometProjectMode } from "./project-mode.js";
import type { CometArchiveCheckReport } from "./types.js";
import {
  buildVerificationFingerprintForMode,
  readPlaywrightVerifyReceipt
} from "./verify.js";

export async function archiveCheckCometChange(
  projectRoot: string,
  change: string
): Promise<CometArchiveCheckReport> {
  if ((await resolveHarnessCometProjectMode(projectRoot)) !== "playwright") {
    return archiveCheckLegacyCometChange(projectRoot, change);
  }
  return archiveCheckPlaywrightCometChange(projectRoot, change);
}

async function archiveCheckPlaywrightCometChange(
  projectRoot: string,
  change: string
): Promise<CometArchiveCheckReport> {
  const { data } = await readChangeCometYaml(projectRoot, change);
  const { impact } = await readPlaywrightHarnessImpact(projectRoot, change);
  if (data.phase !== "archive") {
    throw configError("COMET_ARCHIVE_PHASE_INVALID", `Archive check requires phase=archive for ${change}`);
  }
  if (data.verify_result !== "pass") {
    throw configError("COMET_ARCHIVE_VERIFY_RESULT_INVALID", `Archive check requires verify_result=pass for ${change}`);
  }

  const changeRoot = resolveChangeRoot(projectRoot, change);
  const receiptPath = path.join(changeRoot, ".comet", "harness", "verify-receipt.json");
  const receipt = await readPlaywrightVerifyReceipt(receiptPath);
  const fingerprint = await buildVerificationFingerprintForMode(projectRoot, "playwright");

  if (impact.action === "none") {
    const matches = matchesPlaywrightArchiveFingerprint(receipt, {
      action: "none",
      status: "not-applicable",
      configHash: fingerprint.configHash,
      assetHash: fingerprint.assetHash,
      targetTests: []
    });
    if (!matches) {
      throw configError("COMET_ARCHIVE_FINGERPRINT_MISMATCH", `Archive check fingerprint mismatch for ${change}`);
    }
    const reportPath = resolveReceiptReportPath(projectRoot, receipt.reportPath);
    const report = await fs.readFile(reportPath, "utf8");
    validateNoneReport(report, receipt, change, reportPath);
    return {
      change,
      receiptPath,
      reportPath,
      gitTreeHash: fingerprint.gitTreeHash,
      status: "passed"
    };
  }

  const targetTests = await extractPlaywrightTargetTestsFromDesign(projectRoot, change);
  const selectedTargets = getRunnablePlaywrightTargets(targetTests).map((target) => target.path);
  const matches = matchesPlaywrightArchiveFingerprint(receipt, {
    action: impact.action,
    status: "passed",
    configHash: fingerprint.configHash,
    assetHash: fingerprint.assetHash,
    targetTests: selectedTargets
  });
  if (!matches) {
    throw configError("COMET_ARCHIVE_FINGERPRINT_MISMATCH", `Archive check fingerprint mismatch for ${change}`);
  }

  const reportPath = resolveReceiptReportPath(projectRoot, receipt.reportPath);
  const report = await fs.readFile(reportPath, "utf8");
  if (!report.includes("## Harness Playwright Verification")) {
    throw configError(
      "COMET_ARCHIVE_REPORT_SECTION_MISSING",
      `Comet verification report is missing the Harness Playwright Verification section for ${change}`,
      reportPath
    );
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

function resolveReceiptReportPath(projectRoot: string, reportPath: string): string {
  return path.isAbsolute(reportPath) ? reportPath : path.join(projectRoot, reportPath);
}

function validateNoneReport(
  report: string,
  receipt: Awaited<ReturnType<typeof readPlaywrightVerifyReceipt>>,
  change: string,
  reportPath: string
): void {
  if (!report.includes("## Harness Playwright Verification")) {
    throw configError("COMET_ARCHIVE_REPORT_SECTION_MISSING", `Comet verification report is missing the Harness Playwright Verification section for ${change}`, reportPath);
  }
  if (!report.includes("- Action: none")) {
    throw configError("COMET_ARCHIVE_REPORT_ACTION_MISMATCH", `Comet verification report action mismatch for ${change}`, reportPath);
  }
  if (!report.includes("- Status: NOT-APPLICABLE")) {
    throw configError("COMET_ARCHIVE_REPORT_STATUS_MISMATCH", `Comet verification report status mismatch for ${change}`, reportPath);
  }
  const expectedReceipt = `- Receipt: \`openspec/changes/${change}/.comet/harness/verify-receipt.json\``;
  if (!report.includes(expectedReceipt)) {
    throw configError("COMET_ARCHIVE_REPORT_RECEIPT_MISMATCH", `Comet verification report receipt path mismatch for ${change}`, reportPath);
  }
  if (receipt.resultsPath !== "not-applicable" || receipt.evidenceCount !== 0) {
    throw configError("COMET_ARCHIVE_RECEIPT_INVALID", `Archive check requires a not-applicable Playwright receipt for ${change}`, reportPath);
  }
}

function configError(code: string, message: string, filePath?: string): HarnessError {
  return new HarnessError({ code, category: "config", message, path: filePath });
}
