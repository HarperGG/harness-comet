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

async function initGitRepo(root: string): Promise<void> {
  await execa("git", ["init"], { cwd: root });
  await execa("git", ["config", "user.name", "Harness Comet"], { cwd: root });
  await execa("git", ["config", "user.email", "harness@example.com"], { cwd: root });
}

async function commitAll(root: string, message: string): Promise<void> {
  await execa("git", ["add", "."], { cwd: root });
  await execa("git", ["commit", "-m", message], { cwd: root });
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
});
