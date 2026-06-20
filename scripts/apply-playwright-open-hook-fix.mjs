import { readFile, writeFile } from "node:fs/promises";

const hooksPath = "packages/comet-adapter/src/hooks.ts";
let hooks = await readFile(hooksPath, "utf8");

const start = hooks.indexOf("async function runCometPlaywrightOpenHook(");
const end = hooks.indexOf("async function runCometPlaywrightDesignHook(", start);
if (start === -1 || end === -1) throw new Error("Playwright open-hook function anchors not found");

const replacement = `async function runCometPlaywrightOpenHook(
  projectRoot: string,
  change: string
): Promise<CometHookReport> {
  const changeRoot = await ensureChangeRoot(projectRoot, change);
  const proposalPath = path.join(changeRoot, "proposal.md");
  const tasksPath = path.join(changeRoot, "tasks.md");
  const proposal = await readRequiredFile(
    proposalPath,
    "COMET_OPEN_PROPOSAL_MISSING",
    "Open proposal doc not found"
  );
  const tasks = await readRequiredFile(
    tasksPath,
    "COMET_OPEN_TASKS_MISSING",
    "Open tasks doc not found"
  );

  const impact = extractSection(proposal, "Playwright Impact Analysis");
  if (!impact.trim()) {
    throw new HarnessError({
      code: "COMET_OPEN_PLAYWRIGHT_IMPACT_MISSING",
      category: "config",
      message: \`Playwright Impact Analysis is required for \${change}\`,
      path: proposalPath
    });
  }

  const decision = extractSection(proposal, "Playwright Authoring Decision");
  const enabledMatch = decision.match(/\\benabled:\\s*(true|false)\\b/i);
  if (!enabledMatch) {
    throw new HarnessError({
      code: "COMET_OPEN_DECISIONS_MISSING",
      category: "config",
      message: \`Playwright Authoring Decision enabled state is required for \${change}\`,
      path: proposalPath
    });
  }

  const confirmedByMatch = decision.match(/\\bconfirmedBy:\\s*([a-z-]+)\\b/i);
  if (confirmedByMatch?.[1]?.toLowerCase() !== "user") {
    throw new HarnessError({
      code: "COMET_OPEN_CONFIRMED_BY_INVALID",
      category: "config",
      message: \`Playwright Authoring Decision must be confirmed by the user for \${change}\`,
      path: proposalPath
    });
  }

  const allowedOperations = new Set(["verify", "update", "create", "retire", "ignore"]);
  const operationMatches = [...decision.matchAll(/^\\s*operation:\\s*([a-z-]+)\\s*$/gim)];
  for (const match of operationMatches) {
    const operation = match[1].toLowerCase();
    if (!allowedOperations.has(operation)) {
      throw new HarnessError({
        code: "COMET_OPEN_DECISION_OPERATION_INVALID",
        category: "config",
        message: \`Unsupported Playwright target operation: \${operation} for \${change}\`,
        path: proposalPath
      });
    }
  }

  const enabled = enabledMatch[1].toLowerCase() === "true";
  const activeOperations = operationMatches
    .map((match) => match[1].toLowerCase())
    .filter((operation) => operation !== "ignore");
  if (enabled && activeOperations.length === 0) {
    throw new HarnessError({
      code: "COMET_OPEN_DECISIONS_MISSING",
      category: "config",
      message: \`Enabled Playwright authoring requires at least one non-ignored target for \${change}\`,
      path: proposalPath
    });
  }

  if (enabled && !/playwright/i.test(tasks)) {
    throw new HarnessError({
      code: "COMET_OPEN_TASKS_INVALID",
      category: "config",
      message: \`Playwright planning, implementation, and verification tasks are required in tasks.md for \${change}\`,
      path: tasksPath
    });
  }

  return { hook: "open", change, status: "passed" };
}

`;

hooks = hooks.slice(0, start) + replacement + hooks.slice(end);
await writeFile(hooksPath, hooks);
