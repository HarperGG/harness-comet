import { chmod, mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execa } from "execa";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];
const originalBin = process.env.HARNESS_COMET_COMET_BIN;
const systemPnpm = "/usr/local/bin/pnpm";

afterEach(() => {
  if (originalBin === undefined) delete process.env.HARNESS_COMET_COMET_BIN;
  else process.env.HARNESS_COMET_COMET_BIN = originalBin;
});

async function createFakeComet(version = "0.3.8"): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "fake-comet-bin-"));
  const script = path.join(root, "comet");
  await writeFile(script, `#!/bin/sh\necho 'comet ${version}'\n`, "utf8");
  await chmod(script, 0o755);
  return script;
}

async function initGitRepo(root: string): Promise<void> {
  await execa("git", ["init"], { cwd: root });
  await execa("git", ["config", "user.name", "Harness Comet"], { cwd: root });
  await execa("git", ["config", "user.email", "harness@example.com"], { cwd: root });
}

async function createFakeNpm(root: string): Promise<string> {
  const binDir = path.join(root, "bin");
  const script = path.join(binDir, "npm");
  await mkdir(binDir, { recursive: true });
  await writeFile(
    script,
    `#!/bin/sh
set -eu
if [ "$1" = "exec" ] && [ "$2" = "playwright" ]; then
  mkdir -p "$(dirname "$HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE")"
  cat > "$HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE" <<'EOF'
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-16T00:00:00.000Z",
  "tests": [
    {
      "project": "chromium",
      "file": "tests/example.spec.ts",
      "title": "Example save flow",
      "tags": ["@harness"],
      "annotations": [],
      "status": "passed",
      "duration": 5,
      "retry": 0,
      "errors": [],
      "attachments": []
    }
  ]
}
EOF
  exit 0
fi
exit 1
`,
    "utf8"
  );
  await chmod(script, 0o755);
  return binDir;
}

async function createFakePnpm(root: string): Promise<string> {
  const binDir = path.join(root, "bin-pnpm");
  const script = path.join(binDir, "pnpm");
  await mkdir(binDir, { recursive: true });
  await writeFile(
    script,
    `#!/bin/sh
set -eu
if [ "$1" = "exec" ] && [ "$2" = "playwright" ]; then
  mkdir -p "$(dirname "$HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE")"
  cat > "$HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE" <<'EOF'
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-16T00:00:00.000Z",
  "tests": [
    {
      "project": "chromium",
      "file": "tests/example.spec.ts",
      "title": "Example save flow",
      "tags": ["@harness"],
      "annotations": [],
      "status": "passed",
      "duration": 5,
      "retry": 0,
      "errors": [],
      "attachments": []
    }
  ]
}
EOF
  exit 0
fi
exec "${systemPnpm}" "$@"
`,
    "utf8"
  );
  await chmod(script, 0o755);
  return binDir;
}

async function commitAll(root: string, message: string): Promise<void> {
  await execa("git", ["add", "."], { cwd: root });
  await execa("git", ["commit", "-m", message], { cwd: root });
}

async function updatePlaywrightReceipt(
  root: string,
  change: string,
  mutate: (receipt: Record<string, unknown>) => Record<string, unknown>
): Promise<void> {
  const receiptPath = path.join(
    root,
    "openspec",
    "changes",
    change,
    ".comet",
    "harness",
    "verify-receipt.json"
  );
  const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as Record<string, unknown>;
  await writeFile(receiptPath, `${JSON.stringify(mutate(receipt), null, 2)}\n`, "utf8");
}

async function readPlaywrightReceipt(root: string, change: string): Promise<Record<string, unknown>> {
  const receiptPath = path.join(
    root,
    "openspec",
    "changes",
    change,
    ".comet",
    "harness",
    "verify-receipt.json"
  );
  return JSON.parse(await readFile(receiptPath, "utf8")) as Record<string, unknown>;
}

async function resolvePlaywrightReportPath(root: string, change: string): Promise<string> {
  const receipt = await readPlaywrightReceipt(root, change);
  const reportPath = receipt.reportPath;
  if (typeof reportPath !== "string" || reportPath.length === 0) {
    throw new Error(`Missing reportPath in Playwright receipt for ${change}`);
  }
  return path.isAbsolute(reportPath) ? reportPath : path.join(root, reportPath);
}

async function createArchiveReadyChange(root: string, change: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    "phase: archive\nverify_result: pass\ndesign_doc: design.md\n",
    "utf8"
  );
  await writeFile(
    path.join(changeRoot, "design.md"),
    `## Harness Impact

- Mode: maintain
- Reason: keep existing assets aligned
- Affected capabilities:
  - component: example-memory
  - capability: store-message
  - behavior: write-and-read-message
- Existing asset candidates:
  - scenario: example-smoke
- Asset decisions:
  - reuse scenario example-smoke candidate pending review

## Harness Design

### Impact Mode

- Mode: maintain
- Reason: keep existing assets aligned

### Asset Decision Table

| assetType | assetId | decision | reason | contractChange | evidence |
| --------- | ------- | -------- | ------ | -------------- | -------- |
| scenario | example-smoke | reuse | existing scenario still matches | no | impact-analyze |

### Scenario Decision
- reuse example-smoke

### Fixture Decision
- reuse example-empty

### Adapter Decision
- reuse adapter memory surface pending review

### Oracle Decision
- reuse oracle value.equals pending review
`,
    "utf8"
  );
}

async function createArchiveOffChange(root: string, change: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    "phase: archive\nverify_result: pass\ndesign_doc: design.md\n",
    "utf8"
  );
  await writeFile(
    path.join(changeRoot, "design.md"),
    `## Harness Impact

- Mode: off
- Reason: project has no Harness onboarding
- Affected capabilities:
  - none
- Existing asset candidates:
  - none
- Asset decisions:
  - none
`,
    "utf8"
  );
}

async function createPlaywrightArchiveReadyChange(
  root: string,
  change: string,
  action: "none" | "verify-existing" | "update-or-create" = "verify-existing"
): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    "phase: archive\nverify_result: pass\ndesign_doc: design.md\n",
    "utf8"
  );
  if (action === "none") {
    await writeFile(
      path.join(changeRoot, "design.md"),
      `## Harness Playwright Impact

- Action: none
- Reason: no test asset impact
- Confirmed by: user
- Reviewed existing tests:
  - tests/example.spec.ts

## Harness Playwright Plan

- Action: none
`,
      "utf8"
    );
    return;
  }
  await writeFile(
    path.join(changeRoot, "design.md"),
    `## Harness Playwright Impact

- Action: ${action}
- Reason: existing target remains valid
- Confirmed by: user
- Reviewed existing tests:
  - tests/example.spec.ts

## Harness Playwright Plan

- Action: ${action}

### Target tests

- path: tests/example.spec.ts | operation: verify | reason: existing target remains valid
- path: tests/legacy.spec.ts | operation: retire | reason: no longer part of active coverage

### Related test assets

- path: playwright.config.ts | reason: reporter config

### Expected evidence

- payload.json
`,
    "utf8"
  );
}

describe("comet archive-check integration", () => {
  it("passes when receipt, report, and fingerprints are fresh", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-archive-check-pass-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    await createArchiveReadyChange(root, "demo-change");
    await commitAll(root, "init project");
    await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "verify",
      "--change",
      "demo-change"
    ]);

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "archive-check",
      "--change",
      "demo-change"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CHANGE demo-change");
    expect(result.stdout).toContain("STATUS passed");
  });

  it("fails when git tree changed after verify", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-archive-check-stale-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    await createArchiveReadyChange(root, "demo-change");
    await commitAll(root, "init project");
    await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "verify",
      "--change",
      "demo-change"
    ]);

    const scenarioPath = path.join(root, "harness", "scenarios", "example-smoke.scenario.yaml");
    const scenario = await readFile(scenarioPath, "utf8");
    await writeFile(scenarioPath, `${scenario}\n`, "utf8");

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "archive-check", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Archive check fingerprint mismatch");
  });

  it("passes for off mode without requiring a verify receipt", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-archive-check-off-"));
    await initGitRepo(root);
    await createArchiveOffChange(root, "demo-change");
    await commitAll(root, "init project");

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "archive-check",
      "--change",
      "demo-change"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("CHANGE demo-change");
    expect(result.stdout).toContain("STATUS passed");
  });

  it("fails for playwright none receipts when fingerprints become stale", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-archive-check-playwright-none-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--mode", "playwright", "--skip-install", "--skip-browsers", "--yes"]);
    await createPlaywrightArchiveReadyChange(root, "demo-change", "none");
    await commitAll(root, "init playwright project");
    await execa("pnpm", [...cli, "--root", root, "comet", "verify", "--change", "demo-change"]);

    const specPath = path.join(root, "tests", "journeys", "example-save-flow.spec.ts");
    const spec = await readFile(specPath, "utf8");
    await writeFile(specPath, `${spec}\n`, "utf8");

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "archive-check", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Archive check fingerprint mismatch");
  });

  it("fails for playwright none receipts when the verify report is deleted", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-archive-check-playwright-none-report-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--mode", "playwright", "--skip-install", "--skip-browsers", "--yes"]);
    await createPlaywrightArchiveReadyChange(root, "demo-change", "none");
    await commitAll(root, "init playwright project");
    await execa("pnpm", [...cli, "--root", root, "comet", "verify", "--change", "demo-change"]);

    const reportPath = path.join(
      root,
      "docs",
      "superpowers",
      "reports",
      `${new Date().toISOString().slice(0, 10)}-demo-change-harness.md`
    );
    await writeFile(reportPath, "", "utf8");

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "archive-check", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Harness Playwright Verification section");
  });

  it("uses the playwright receipt reportPath during archive-check", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-archive-check-playwright-report-path-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--mode", "playwright", "--skip-install", "--skip-browsers", "--yes"]);
    await createPlaywrightArchiveReadyChange(root, "demo-change", "none");
    await commitAll(root, "init playwright project");
    await execa("pnpm", [...cli, "--root", root, "comet", "verify", "--change", "demo-change"]);

    const originalReportPath = await resolvePlaywrightReportPath(root, "demo-change");
    const receiptReportPath = path.join(root, "docs", "superpowers", "reports", "archived-demo-change-harness.md");
    const report = await readFile(originalReportPath, "utf8");
    await rename(originalReportPath, receiptReportPath);
    await writeFile(receiptReportPath, report, "utf8");
    await updatePlaywrightReceipt(root, "demo-change", (receipt) => ({
      ...receipt,
      reportPath: path.relative(root, receiptReportPath)
    }));

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "archive-check", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("STATUS passed");
  });

  it("fails for playwright none receipts when the impact action changes", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-archive-check-playwright-none-action-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--mode", "playwright", "--skip-install", "--skip-browsers", "--yes"]);
    await createPlaywrightArchiveReadyChange(root, "demo-change", "none");
    await commitAll(root, "init playwright project");
    await execa("pnpm", [...cli, "--root", root, "comet", "verify", "--change", "demo-change"]);

    await createPlaywrightArchiveReadyChange(root, "demo-change", "verify-existing");

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "archive-check", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Archive check fingerprint mismatch");
  });

  it("fails for playwright none receipts when resultsPath is not not-applicable", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-archive-check-playwright-none-results-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--mode", "playwright", "--skip-install", "--skip-browsers", "--yes"]);
    await createPlaywrightArchiveReadyChange(root, "demo-change", "none");
    await commitAll(root, "init playwright project");
    await execa("pnpm", [...cli, "--root", root, "comet", "verify", "--change", "demo-change"]);

    await updatePlaywrightReceipt(root, "demo-change", (receipt) => ({
      ...receipt,
      resultsPath: "test-results/unexpected.json"
    }));

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "archive-check", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("resultsPath=not-applicable");
  });

  it("fails for playwright none receipts when evidenceCount is not zero", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-archive-check-playwright-none-evidence-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--mode", "playwright", "--skip-install", "--skip-browsers", "--yes"]);
    await createPlaywrightArchiveReadyChange(root, "demo-change", "none");
    await commitAll(root, "init playwright project");
    await execa("pnpm", [...cli, "--root", root, "comet", "verify", "--change", "demo-change"]);

    await updatePlaywrightReceipt(root, "demo-change", (receipt) => ({
      ...receipt,
      evidenceCount: 1
    }));

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "archive-check", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("evidenceCount=0");
  });

  it("ignores retired playwright targets by operation instead of filename suffix", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-archive-check-playwright-retire-"));
    const fakeBin = await createFakePnpm(root);
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--mode", "playwright", "--skip-install", "--skip-browsers", "--yes"]);
    await createPlaywrightArchiveReadyChange(root, "demo-change", "update-or-create");
    await commitAll(root, "init playwright project");
    await execa("pnpm", [...cli, "--root", root, "comet", "verify", "--change", "demo-change"], {
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH ?? ""}`
      }
    });

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "archive-check",
      "--change",
      "demo-change"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("STATUS passed");
  });
});
