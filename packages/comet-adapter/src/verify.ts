import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import {
  discoverHarnessAssets,
  discoverPlaywrightHarnessAssets,
  loadHarnessCometConfig,
  loadHarnessConfig,
  mapErrorToExitCode,
  runHarness,
  runPlaywrightHarness,
  HarnessError
} from "@harness-comet/core";
import { HARNESS_COMET_VERSION, sha256, writeFileAtomic } from "./manifest.js";
import { detectCometCli } from "./discovery/comet-cli.js";
import {
  extractPlaywrightTargetTestsFromDesign,
  extractScenarioIdsFromDesign,
  ensureChangeRoot,
  readHarnessImpact,
  readPlaywrightHarnessDesign,
  readPlaywrightHarnessImpact
} from "./change.js";
import { findUnauthorizedPlaywrightCreates } from "./hooks.js";
import { resolveHarnessCometProjectMode } from "./project-mode.js";
import type { CometVerifyReport, VerifyReceiptV1 } from "./types.js";

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

  if (impact.mode === "off") {
    if (await projectHasPlaywrightHarnessAssets(projectRoot)) {
      throw new HarnessError({
        code: "COMET_VERIFY_OFF_INVALID",
        category: "config",
        message: `Harness Playwright Impact mode off is not allowed for an onboarded Harness project: ${change}`
      });
    }
    await writeVerificationSkipReport(reportPath, change, impact.reason, "playwright");
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

  const { design } = await readPlaywrightHarnessDesign(projectRoot, change);
  const targetTests = await extractPlaywrightTargetTestsFromDesign(projectRoot, change);
  const unauthorizedCreates = await findUnauthorizedPlaywrightCreates(projectRoot, impact, design);
  if (design.mode === "maintain" && unauthorizedCreates.length > 0) {
    throw new HarnessError({
      code: "COMET_VERIFY_PLAYWRIGHT_MAINTAIN_CREATE_INVALID",
      category: "config",
      message: `Maintain mode cannot create new Playwright assets: ${unauthorizedCreates.join(", ")}`
    });
  }
  if (design.mode === "off" && unauthorizedCreates.length > 0) {
    throw new HarnessError({
      code: "COMET_VERIFY_PLAYWRIGHT_OFF_INVALID",
      category: "config",
      message: `Off mode cannot create Playwright assets: ${unauthorizedCreates.join(", ")}`
    });
  }
  const selectedScenarios = targetTests.map((target) => target.scenarioId ?? target.path);
  const { configHash, assetHash, gitTreeHash } = await buildVerificationFingerprintForMode(
    projectRoot,
    "playwright"
  );
  const reusable = await readReusableVerifyReceipt(
    receiptPath,
    gitTreeHash,
    configHash,
    assetHash,
    selectedScenarios
  );
  if (reusable) {
    await writeVerificationReport(projectRoot, reportPath, reusable, true, "playwright");
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

  const project = await loadHarnessCometConfig({ root: projectRoot });
  if (project.config.mode !== "playwright") {
    throw new HarnessError({
      code: "COMET_VERIFY_MODE_INVALID",
      category: "config",
      message: `Expected mode=playwright for ${change}`
    });
  }

  const code = await runPlaywrightHarness({
    root: projectRoot,
    configFile: project.config.playwright.configFile,
    args: targetTests.map((target) => target.path)
  });
  const status: VerifyReceiptV1["status"] = code === 0 ? "passed" : code === 1 ? "failed" : "error";
  const receipt: VerifyReceiptV1 = {
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
  await writeVerificationReport(projectRoot, reportPath, receipt, false, "playwright", design.verificationCommands);
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

function normalizeRunStatus(status: string): VerifyReceiptV1["status"] {
  if (status === "passed") return "passed";
  if (status === "failed") return "failed";
  return "error";
}

export async function readReusableVerifyReceipt(
  receiptPath: string,
  gitTreeHash: string,
  configHash: string,
  assetHash: string,
  selectedScenarios: string[]
): Promise<VerifyReceiptV1 | undefined> {
  try {
    const content = await fs.readFile(receiptPath, "utf8");
    const receipt = JSON.parse(content) as VerifyReceiptV1;
    if (
      receipt.status === "passed" &&
      receipt.gitTreeHash === gitTreeHash &&
      receipt.configHash === configHash &&
      receipt.assetHash === assetHash &&
      JSON.stringify(receipt.selectedScenarios) === JSON.stringify(selectedScenarios)
    ) {
      return receipt;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

async function writeReceipt(receiptPath: string, receipt: VerifyReceiptV1): Promise<void> {
  await fs.mkdir(path.dirname(receiptPath), { recursive: true });
  await writeFileAtomic(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 0o644);
}

export async function readVerifyReceipt(receiptPath: string): Promise<VerifyReceiptV1> {
  try {
    return JSON.parse(await fs.readFile(receiptPath, "utf8")) as VerifyReceiptV1;
  } catch {
    throw new HarnessError({
      code: "COMET_VERIFY_RECEIPT_MISSING",
      category: "config",
      message: "Verify receipt not found",
      path: receiptPath
    });
  }
}

async function hashFile(filePath: string): Promise<string> {
  try {
    return sha256(await fs.readFile(filePath, "utf8"));
  } catch {
    throw new HarnessError({
      code: "COMET_VERIFY_CONFIG_MISSING",
      category: "config",
      message: "Harness config not found for comet verify",
      path: filePath
    });
  }
}

async function hashHarnessAssets(projectRoot: string): Promise<string> {
  const targets = ["harness/scenarios", "harness/fixtures", "harness/adapters", "harness/oracles"];
  const files: string[] = [];
  for (const target of targets) {
    await collectFiles(path.join(projectRoot, target), files);
  }
  const digest = crypto.createHash("sha256");
  for (const file of files.sort()) {
    digest.update(path.relative(projectRoot, file));
    digest.update(await fs.readFile(file));
  }
  return digest.digest("hex");
}

async function hashPlaywrightAssets(projectRoot: string): Promise<string> {
  const project = await loadHarnessCometConfig({ root: projectRoot });
  if (project.config.mode !== "playwright") return hashHarnessAssets(projectRoot);
  const assets = await discoverPlaywrightHarnessAssets({
    root: projectRoot,
    testDir: project.config.playwright.testDir,
    testMatch: project.config.playwright.testMatch
  });
  const digest = crypto.createHash("sha256");
  for (const asset of assets.tests.sort((left, right) => left.path.localeCompare(right.path))) {
    digest.update(path.relative(projectRoot, asset.path));
    digest.update(await fs.readFile(asset.path));
  }
  return digest.digest("hex");
}

async function collectFiles(root: string, files: string[]): Promise<void> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) await collectFiles(fullPath, files);
      else if (entry.isFile()) files.push(fullPath);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

async function getGitTreeHash(projectRoot: string): Promise<string> {
  const result = await execa("git", ["rev-parse", "HEAD^{tree}"], {
    cwd: projectRoot,
    reject: false
  });
  if (result.exitCode !== 0) {
    throw new HarnessError({
      code: "COMET_VERIFY_GIT_TREE_UNAVAILABLE",
      category: "environment",
      message: "Unable to resolve git tree hash for comet verify"
    });
  }
  return result.stdout.trim();
}

export function buildVerificationReportPath(projectRoot: string, change: string): string {
  const datePrefix = new Date().toISOString().slice(0, 10);
  return path.join(projectRoot, "docs", "superpowers", "reports", `${datePrefix}-${change}-verify.md`);
}

export async function buildVerificationFingerprint(projectRoot: string): Promise<{
  configHash: string;
  assetHash: string;
  gitTreeHash: string;
}> {
  return buildVerificationFingerprintForMode(projectRoot, "runtime");
}

export async function buildVerificationFingerprintForMode(
  projectRoot: string,
  mode: "runtime" | "playwright"
): Promise<{
  configHash: string;
  assetHash: string;
  gitTreeHash: string;
}> {
  return {
    configHash: await hashFile(path.join(projectRoot, "harness-comet.config.ts")),
    assetHash: mode === "playwright" ? await hashPlaywrightAssets(projectRoot) : await hashHarnessAssets(projectRoot),
    gitTreeHash: await getGitTreeHash(projectRoot)
  };
}

async function writeVerificationReport(
  projectRoot: string,
  reportPath: string,
  receipt: VerifyReceiptV1,
  reused: boolean,
  mode: "runtime" | "playwright" = "runtime",
  commands: string[] = []
): Promise<void> {
  const heading = mode === "playwright" ? "## Harness Playwright Verification" : "## Harness Verification";
  const commandLine =
    commands.length > 0
      ? `- Commands run: ${commands.join(" ; ")}`
      : `- Command: \`harness-comet comet verify --change ${receipt.change}\``;
  const body = `${heading}

- ${commandLine.replace(/^- /, "")}
- Status: ${receipt.status.toUpperCase()}
- Selected scenarios: ${receipt.selectedScenarios.join(", ")}
- Receipt: \`openspec/changes/${receipt.change}/.comet/harness/verify-receipt.json\`
- Git tree hash: ${receipt.gitTreeHash}
- Notes: Reused receipt = ${reused ? "yes" : "no"}
`;
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await writeFileAtomic(reportPath, `${body}\n`, 0o644);
}

async function writeVerificationSkipReport(
  reportPath: string,
  change: string,
  reason: string,
  mode: "runtime" | "playwright" = "runtime"
): Promise<void> {
  const heading = mode === "playwright" ? "## Harness Playwright Verification" : "## Harness Verification";
  const body = `${heading}

- Command: \`harness-comet comet verify --change ${change}\`
- Status: PASSED
- Selected scenarios: -
- Receipt: \`not-applicable\`
- Git tree hash: not-applicable
- Notes: Skipped because Harness Impact mode is off (${reason})
`;
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await writeFileAtomic(reportPath, `${body}\n`, 0o644);
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

async function projectHasHarnessAssets(projectRoot: string): Promise<boolean> {
  try {
    const config = await loadHarnessConfig({ root: projectRoot });
    const assets = await discoverHarnessAssets(config);
    return assets.scenarios.length + assets.fixtures.length > 0;
  } catch {
    return false;
  }
}
