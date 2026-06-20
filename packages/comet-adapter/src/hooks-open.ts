import fs from "node:fs/promises";
import path from "node:path";
import { HarnessError } from "@hapergg/harness-comet-core";
import { ensureChangeRoot } from "./change.js";
import {
  runCometOpenHook as runLegacyCometOpenHook,
  type CometHookReport
} from "./hooks.js";
import {
  parsePlaywrightOperations,
  parseQuotedBooleanField,
  parseQuotedWordField,
  PLAYWRIGHT_OPEN_OPERATIONS
} from "./playwright-open-fields.js";
import { resolveHarnessCometProjectMode } from "./project-mode.js";

export async function runCometOpenHook(
  projectRoot: string,
  change: string
): Promise<CometHookReport> {
  if ((await resolveHarnessCometProjectMode(projectRoot)) !== "playwright") {
    return runLegacyCometOpenHook(projectRoot, change);
  }

  const changeRoot = await ensureChangeRoot(projectRoot, change);
  const proposalPath = path.join(changeRoot, "proposal.md");
  const tasksPath = path.join(changeRoot, "tasks.md");
  const proposal = await readRequiredFile(proposalPath, "COMET_OPEN_PROPOSAL_MISSING", "Open proposal doc not found");
  const tasks = await readRequiredFile(tasksPath, "COMET_OPEN_TASKS_MISSING", "Open tasks doc not found");

  const impact = extractSection(proposal, "Playwright Impact Analysis");
  if (!impact.trim()) {
    throw configError("COMET_OPEN_PLAYWRIGHT_IMPACT_MISSING", `Playwright Impact Analysis is required for ${change}`, proposalPath);
  }

  const decision = extractSection(proposal, "Playwright Authoring Decision");
  const enabled = parseQuotedBooleanField(decision, "enabled");
  if (enabled === null) {
    throw configError("COMET_OPEN_DECISIONS_MISSING", `Playwright Authoring Decision enabled state is required for ${change}`, proposalPath);
  }

  if (parseQuotedWordField(decision, "confirmedBy") !== "user") {
    throw configError("COMET_OPEN_CONFIRMED_BY_INVALID", `Playwright Authoring Decision must be confirmed by the user for ${change}`, proposalPath);
  }

  const operations = parsePlaywrightOperations(decision);
  for (const operation of operations) {
    if (!PLAYWRIGHT_OPEN_OPERATIONS.has(operation)) {
      throw configError("COMET_OPEN_DECISION_OPERATION_INVALID", `Unsupported Playwright target operation: ${operation} for ${change}`, proposalPath);
    }
  }

  if (enabled && operations.length === 0) {
    throw configError("COMET_OPEN_DECISION_OPERATION_MISSING", `No Playwright target operations could be parsed for ${change}. Use operation: verify|update|create|retire|ignore.`, proposalPath);
  }
  if (enabled && operations.every((operation) => operation === "ignore")) {
    throw configError("COMET_OPEN_DECISIONS_MISSING", `Enabled Playwright authoring requires at least one non-ignored target for ${change}`, proposalPath);
  }
  if (enabled && !/playwright/i.test(tasks)) {
    throw configError("COMET_OPEN_TASKS_INVALID", `Playwright planning, implementation, and verification tasks are required in tasks.md for ${change}`, tasksPath);
  }

  return { hook: "open", change, status: "passed" };
}

async function readRequiredFile(filePath: string, code: string, message: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    throw configError(code, message, filePath);
  }
}

function extractSection(content: string, heading: string): string {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start === -1) throw configError("COMET_DOC_SECTION_MISSING", `Missing section: ${heading}`);
  const collected: string[] = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) break;
    collected.push(lines[index]);
  }
  return collected.join("\n");
}

function configError(code: string, message: string, filePath?: string): HarnessError {
  return new HarnessError({ code, category: "config", message, path: filePath });
}
