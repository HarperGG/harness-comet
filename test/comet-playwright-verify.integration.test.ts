import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execa } from "execa";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];
const originalBin = process.env.HARNESS_COMET_COMET_BIN;

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

async function createFakeNpm(root: string): Promise<string> {
  const binDir = path.join(root, "bin");
  const script = path.join(binDir, "npm");
  await mkdir(binDir, { recursive: true });
  await writeFile(
    script,
    `#!/bin/sh
set -eu
if [ "$1" = "exec" ] && [ "$2" = "playwright" ]; then
  target="tests/example.spec.ts"
  for arg in "$@"; do
    case "$arg" in
      *.spec.ts) target="$arg" ;;
    esac
  done
  mkdir -p "$(dirname "$HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE")"
  cat > "$HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE" <<EOF
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-16T00:00:00.000Z",
  "tests": [
    {
      "project": "chromium",
      "file": "$target",
      "title": "Example smoke",
      "tags": ["@harness"],
      "annotations": [],
      "status": "passed",
      "duration": 12,
      "retry": 0,
      "errors": [],
      "attachments": [
        {
          "name": "payload.json",
          "contentType": "application/json",
          "path": "test-results/payload.json"
        }
      ]
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

async function initGitRepo(root: string): Promise<void> {
  await execa("git", ["init"], { cwd: root });
  await execa("git", ["config", "user.name", "Harness Comet"], { cwd: root });
  await execa("git", ["config", "user.email", "harness@example.com"], { cwd: root });
}

async function commitAll(root: string, message: string): Promise<void> {
  await execa("git", ["add", "."], { cwd: root });
  await execa("git", ["commit", "-m", message], { cwd: root });
}

async function createPlaywrightProject(root: string): Promise<void> {
  await mkdir(path.join(root, "tests"), { recursive: true });
  await writeFile(
    path.join(root, "harness-comet.config.ts"),
    `export default {
  schemaVersion: 1,
  mode: "playwright",
  playwright: {
    configFile: "playwright.config.ts",
    testDir: "tests",
    testMatch: ["**/*.spec.ts"]
  }
};
`,
    "utf8"
  );
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ packageManager: "npm@10.8.2" }, null, 2),
    "utf8"
  );
  await writeFile(path.join(root, "playwright.config.ts"), "export default {};\n", "utf8");
  await writeFile(
    path.join(root, "tests", "example.spec.ts"),
    `import { defineHarnessScenario } from "@hapergg/harness-comet-playwright";
defineHarnessScenario({
  id: "example-smoke",
  title: "Example smoke",
  component: "example",
  capability: "render-page",
  behavior: "show-page",
  contract: "example-page-visible"
});
`,
    "utf8"
  );
}

async function createChange(root: string, change: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    "phase: verify\ndesign_doc: design.md\nverify_result: pass\n",
    "utf8"
  );
  await writeFile(
    path.join(changeRoot, "design.md"),
    `## Harness Playwright Impact

- Action: verify-existing
- Reason: same contract should stay inside existing assets
- Confirmed by: user
- Reviewed existing tests:
  - tests/example.spec.ts

## Harness Playwright Plan

- Action: verify-existing

### Target tests

- path: tests/new-flow.spec.ts | operation: update | reason: incorrectly added new file

### Related test assets

- path: playwright.config.ts | reason: unchanged

### Expected evidence

- playwright test tests/new-flow.spec.ts
`,
    "utf8"
  );
}

describe("comet playwright verify integration", () => {
  it("verify rejects unauthorized new playwright assets in maintain mode", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "comet-pw-verify-"));
    await createPlaywrightProject(root);
    await createChange(root, "demo-change");
    await writeFile(
      path.join(root, "tests", "new-flow.spec.ts"),
      `import { defineHarnessScenario } from "@hapergg/harness-comet-playwright";
defineHarnessScenario({
  id: "new-flow",
  title: "New flow",
  component: "example",
  capability: "render-page",
  behavior: "show-page",
  contract: "example-page-visible"
});
`,
      "utf8"
    );

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "verify", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Action verify-existing cannot create new Playwright assets");
    expect(`${result.stdout}\n${result.stderr}`).toContain("tests/new-flow.spec.ts");
  });

  it("verify writes playwright receipt v2, results, and report for declared targets", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "comet-pw-verify-pass-"));
    const fakeBin = await createFakeNpm(root);
    await initGitRepo(root);
    await createPlaywrightProject(root);
    await createChange(root, "demo-change");
    await writeFile(
      path.join(root, "openspec", "changes", "demo-change", "design.md"),
      `## Harness Playwright Impact

- Action: verify-existing
- Reason: same contract should stay inside existing assets
- Confirmed by: user
- Reviewed existing tests:
  - tests/example.spec.ts

## Harness Playwright Plan

- Action: verify-existing

### Target tests

- path: tests/example.spec.ts | operation: verify | reason: same existing contract

### Related test assets

- path: playwright.config.ts | reason: unchanged

### Expected evidence

- playwright test tests/example.spec.ts
`,
      "utf8"
    );
    await commitAll(root, "init playwright project");

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "verify", "--change", "demo-change"],
      {
        env: {
          ...process.env,
          PATH: `${fakeBin}:${process.env.PATH ?? ""}`
        }
      }
    );

    expect(result.exitCode).toBe(0);
    const receipt = JSON.parse(
      await readFile(
        path.join(root, "openspec", "changes", "demo-change", ".comet", "harness", "verify-receipt.json"),
        "utf8"
      )
    );
    expect(receipt).toMatchObject({
      schemaVersion: 2,
      action: "verify-existing",
      status: "passed",
      targetTests: ["tests/example.spec.ts"],
      resultsPath: "test-results/harness-comet/results.json"
    });

    const results = JSON.parse(
      await readFile(path.join(root, "test-results", "harness-comet", "results.json"), "utf8")
    );
    expect(results.tests).toHaveLength(1);
    expect(results.tests[0]).toMatchObject({
      file: "tests/example.spec.ts",
      status: "passed"
    });

    const report = await readFile(
      path.join(root, "docs", "superpowers", "reports", `${new Date().toISOString().slice(0, 10)}-demo-change-harness.md`),
      "utf8"
    );
    expect(report).toContain("## Harness Playwright Verification");
    expect(report).toContain("Results: `test-results/harness-comet/results.json`");
  });
});
