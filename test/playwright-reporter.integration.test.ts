import fs from "node:fs/promises";
import { chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "harness-playwright-reporter-"));
}

async function createFakeNpm(root: string): Promise<string> {
  const binDir = path.join(root, "bin");
  const script = path.join(binDir, "npm");
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(
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
      "title": "Example smoke",
      "tags": ["@harness", "@smoke"],
      "annotations": [{ "type": "incident", "description": "BUG-1842" }],
      "status": "passed",
      "duration": 24,
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

async function createFakeNpmWithoutResults(root: string): Promise<string> {
  const binDir = path.join(root, "bin-no-results");
  const script = path.join(binDir, "npm");
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(
    script,
    `#!/bin/sh
set -eu
if [ "$1" = "exec" ] && [ "$2" = "playwright" ]; then
  exit 0
fi
exit 1
`,
    "utf8"
  );
  await chmod(script, 0o755);
  return binDir;
}

async function createFakeComet(version = "0.3.8"): Promise<string> {
  const root = await fs.mkdtemp(path.join(tmpdir(), "fake-comet-bin-"));
  const script = path.join(root, "comet");
  await fs.writeFile(script, `#!/bin/sh\necho 'comet ${version}'\n`, "utf8");
  await chmod(script, 0o755);
  return script;
}

async function initGitRepo(root: string): Promise<void> {
  await execa("git", ["init"], { cwd: root });
  await execa("git", ["config", "user.name", "Harness Comet"], { cwd: root });
  await execa("git", ["config", "user.email", "harness@example.com"], { cwd: root });
}

describe("playwright reporter integration", () => {
  it("writes structured results JSON consumed by comet verify", async () => {
    const root = await tempProject();
    const fakeBin = await createFakeNpm(root);
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    await initGitRepo(root);
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(
      path.join(root, "harness-comet.config.ts"),
      `export default {
  schemaVersion: 1,
  mode: "playwright",
  playwright: {
    configFile: "playwright.config.ts",
    testDir: "tests",
    testMatch: ["**/*.spec.ts"],
    assetRoots: ["tests"],
    resultsFile: "test-results/harness-comet/results.json"
  }
};
`,
      "utf8"
    );
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ packageManager: "npm@10.8.2" }, null, 2));
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default {};\n");
    await fs.writeFile(path.join(root, "tests", "example.spec.ts"), "export {};\n");
    await fs.mkdir(path.join(root, "openspec", "changes", "demo-change"), { recursive: true });
    await fs.writeFile(
      path.join(root, "openspec", "changes", "demo-change", ".comet.yaml"),
      "phase: verify\ndesign_doc: design.md\nverify_result: pass\n",
      "utf8"
    );
    await fs.writeFile(
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
    await execa("git", ["add", "."], { cwd: root });
    await execa("git", ["commit", "-m", "init reporter project"], { cwd: root });

    const result = await execa("pnpm", [...cli, "--root", root, "comet", "verify", "--change", "demo-change"], {
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH ?? ""}`
      }
    });

    expect(result.exitCode).toBe(0);
    const results = JSON.parse(
      await fs.readFile(path.join(root, "test-results", "harness-comet", "results.json"), "utf8")
    );
    expect(results.tests).toEqual([
      expect.objectContaining({
        file: "tests/example.spec.ts",
        status: "passed",
        project: "chromium"
      })
    ]);
  });

  it("fails with a clear error when the project reporter is not registered", async () => {
    const root = await tempProject();
    const fakeBin = await createFakeNpmWithoutResults(root);
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    await initGitRepo(root);
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(
      path.join(root, "harness-comet.config.ts"),
      `export default {
  schemaVersion: 1,
  mode: "playwright",
  playwright: {
    configFile: "playwright.config.ts",
    testDir: "tests",
    testMatch: ["**/*.spec.ts"],
    assetRoots: ["tests"],
    resultsFile: "test-results/harness-comet/results.json"
  }
};
`,
      "utf8"
    );
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ packageManager: "npm@10.8.2" }, null, 2));
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default { reporter: [[\"list\"]] };\n");
    await fs.writeFile(path.join(root, "tests", "example.spec.ts"), "export {};\n");
    await fs.mkdir(path.join(root, "openspec", "changes", "demo-change"), { recursive: true });
    await fs.writeFile(
      path.join(root, "openspec", "changes", "demo-change", ".comet.yaml"),
      "phase: verify\ndesign_doc: design.md\nverify_result: pass\n",
      "utf8"
    );
    await fs.writeFile(
      path.join(root, "openspec", "changes", "demo-change", "design.md"),
      `## Harness Playwright Impact

- Action: verify-existing
- Reason: existing test should still pass
- Confirmed by: user
- Reviewed existing tests:
  - tests/example.spec.ts

## Harness Playwright Plan

- Action: verify-existing

### Target tests

- path: tests/example.spec.ts | operation: verify | reason: existing test should still pass
`,
      "utf8"
    );
    await execa("git", ["add", "."], { cwd: root });
    await execa("git", ["commit", "-m", "init reporter missing project"], { cwd: root });
    await fs.rm(path.join(root, "test-results"), { recursive: true, force: true });

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "verify", "--change", "demo-change"],
      {
        env: {
          ...process.env,
          PATH: `${fakeBin}:${process.env.PATH ?? ""}`
        },
        reject: false
      }
    );

    expect(result.exitCode).toBe(3);
    expect(result.stderr).toContain("Playwright results file was not produced for demo-change");
  });
});
