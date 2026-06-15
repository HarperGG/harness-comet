import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
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

async function createOpenChange(root: string, change: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    "phase: open\ndesign_doc: design.md\n",
    "utf8"
  );
  await writeFile(
    path.join(changeRoot, "design.md"),
    `## Harness Impact

- Mode: maintain
- Reason: copy-only change in an already onboarded project
- Affected capabilities:
  - example-capability
- Existing asset candidates:
  - scenario: example-smoke
- Asset decisions:
  - reuse scenario example-smoke because contract is unchanged
`,
    "utf8"
  );
  await writeFile(
    path.join(changeRoot, "tasks.md"),
    `- Harness task: implement example-smoke
`,
    "utf8"
  );
}

async function createDesignChange(root: string, change: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    "phase: design\ndesign_doc: design.md\n",
    "utf8"
  );
  await writeFile(
    path.join(changeRoot, "design.md"),
    `## Harness Impact

- Mode: maintain
- Reason: existing contract still applies
- Affected capabilities:
  - example-capability
- Existing asset candidates:
  - scenario: example-smoke
- Asset decisions:
  - update scenario example-smoke because copy changed

## Harness Design

### Impact Mode

- Mode: maintain
- Reason: existing contract still applies

### Asset Decision Table

| assetType | assetId | decision | reason | contractChange | evidence |
| --------- | ------- | -------- | ------ | -------------- | -------- |
| scenario | example-smoke | update | copy changed but flow is same | no | requirement |

### Scenario Decision
- update example-smoke

### Fixture Decision
- reuse example-empty

### Adapter Decision
- reuse memory adapter surface

### Oracle Decision
- reuse value.contains
`,
    "utf8"
  );
}

async function createBuildChange(root: string, change: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    "phase: build\ndesign_doc: design.md\n",
    "utf8"
  );
  await writeFile(
    path.join(changeRoot, "design.md"),
    `## Harness Impact

- Mode: maintain
- Reason: existing contract still applies
- Affected capabilities:
  - example-capability
- Existing asset candidates:
  - scenario: example-smoke
- Asset decisions:
  - update scenario example-smoke because copy changed

## Harness Design

### Impact Mode

- Mode: maintain
- Reason: existing contract still applies

### Asset Decision Table

| assetType | assetId | decision | reason | contractChange | evidence |
| --------- | ------- | -------- | ------ | -------------- | -------- |
| scenario | example-smoke | update | copy changed but flow is same | no | requirement |

### Scenario Decision
- update example-smoke

### Fixture Decision
- reuse example-empty

### Adapter Decision
- reuse memory adapter surface

### Oracle Decision
- reuse value.contains
`,
    "utf8"
  );
  await mkdir(path.join(root, "docs", "superpowers", "plans"), { recursive: true });
  await writeFile(
    path.join(root, "docs", "superpowers", "plans", "build-plan.md"),
    `- Scenario implementation
- Fixture implementation
- Adapter Action implementation
- Inspector implementation
- Oracle implementation
- Harness validation
- Harness scenario execution
`,
    "utf8"
  );
}

describe("comet hook integration", () => {
  it("open hook validates Harness Impact and tasks", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-hook-open-"));
    await createOpenChange(root, "demo-change");

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "hook",
      "open",
      "--change",
      "demo-change"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("HOOK open");
    expect(result.stdout).toContain("STATUS passed");
  });

  it("design hook validates Harness Design fields", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-hook-design-"));
    await createDesignChange(root, "demo-change");

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "hook",
      "design",
      "--change",
      "demo-change"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("HOOK design");
    expect(result.stdout).toContain("STATUS passed");
  });

  it("design hook rejects create decisions in maintain mode", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-hook-design-maintain-"));
    await createDesignChange(root, "demo-change");
    await writeFile(
      path.join(root, "openspec", "changes", "demo-change", "design.md"),
      `## Harness Impact

- Mode: maintain
- Reason: keep current assets aligned
- Affected capabilities:
  - example-capability
- Existing asset candidates:
  - scenario: example-smoke
- Asset decisions:
  - create scenario example-smoke-v2 because it is easier

## Harness Design

### Impact Mode

- Mode: maintain
- Reason: keep current assets aligned

### Asset Decision Table

| assetType | assetId | decision | reason | contractChange | evidence |
| --------- | ------- | -------- | ------ | -------------- | -------- |
| scenario | example-smoke-v2 | create | easier than modifying old scenario | no | none |

### Scenario Decision
- create example-smoke-v2

### Fixture Decision
- reuse example-empty

### Adapter Decision
- reuse memory adapter surface

### Oracle Decision
- reuse value.contains
`,
      "utf8"
    );

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "hook", "design", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("maintain");
    expect(result.stderr).toContain("create");
  });

  it("design hook requires concrete evidence for contract-changing decisions", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-hook-design-evidence-"));
    await createDesignChange(root, "demo-change");
    await writeFile(
      path.join(root, "openspec", "changes", "demo-change", "design.md"),
      `## Harness Impact

- Mode: full
- Reason: business contract changed
- Affected capabilities:
  - component: profile-card
  - capability: render-basic-card
  - behavior: show-title-and-body
  - contract: profile-card-basic-rendering
- Existing asset candidates:
  - scenario: example-smoke
- Asset decisions:
  - update scenario example-smoke because business contract changed

## Harness Design

### Impact Mode

- Mode: full
- Reason: business contract changed

### Asset Decision Table

| assetType | assetId | decision | reason | contractChange | evidence |
| --------- | ------- | -------- | ------ | -------------- | -------- |
| scenario | example-smoke | update | expected contract text changed | yes | impact-analyze |

### Scenario Decision
- update example-smoke

### Fixture Decision
- reuse example-empty

### Adapter Decision
- reuse memory adapter surface

### Oracle Decision
- update value.contains expected text
`,
      "utf8"
    );

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "hook", "design", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("evidence");
    expect(result.stderr).toContain("contract");
  });

  it("build hook runs validate and checks declared scenarios", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-hook-build-"));
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    await createBuildChange(root, "demo-change");

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "hook",
      "build",
      "--change",
      "demo-change"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("HOOK build");
    expect(result.stdout).toContain("STATUS passed");
  });

  it("open hook rejects off mode for an onboarded Harness project", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-hook-open-off-"));
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    const changeRoot = path.join(root, "openspec", "changes", "demo-change");
    await mkdir(changeRoot, { recursive: true });
    await writeFile(
      path.join(changeRoot, ".comet.yaml"),
      "phase: open\ndesign_doc: design.md\n",
      "utf8"
    );
    await writeFile(
      path.join(changeRoot, "design.md"),
      `## Harness Impact

- Mode: off
- Reason: skip harness entirely
- Affected capabilities:
  - none
- Existing asset candidates:
  - none
- Asset decisions:
  - none
`,
      "utf8"
    );
    await writeFile(path.join(changeRoot, "tasks.md"), "- Harness task: none\n", "utf8");

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "hook", "open", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("off");
    expect(result.stderr).toContain("onboarded");
  });

  it("build hook requires consumer impact notes when updating a shared fixture", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-hook-build-fixture-consumers-"));
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    await writeFile(
      path.join(root, "harness", "fixtures", "example-empty", "fixture.yaml"),
      `schemaVersion: 1
id: example-empty
inline: {}
source: synthetic
containsSensitiveData: false
business:
  purpose: example-empty-state
  scope: shared
  consumers:
    - example-smoke
    - another-scenario
`,
      "utf8"
    );
    const changeRoot = path.join(root, "openspec", "changes", "demo-change");
    await mkdir(changeRoot, { recursive: true });
    await writeFile(
      path.join(changeRoot, ".comet.yaml"),
      "phase: build\ndesign_doc: design.md\n",
      "utf8"
    );
    await writeFile(
      path.join(changeRoot, "design.md"),
      `## Harness Impact

- Mode: maintain
- Reason: existing contract still applies
- Affected capabilities:
  - component: example-memory
- Existing asset candidates:
  - scenario: example-smoke
  - fixture: example-empty
- Asset decisions:
  - update scenario example-smoke
  - update fixture example-empty

## Harness Design

### Impact Mode

- Mode: maintain
- Reason: existing contract still applies

### Asset Decision Table

| assetType | assetId | decision | reason | contractChange | evidence |
| --------- | ------- | -------- | ------ | -------------- | -------- |
| scenario | example-smoke | update | same contract changed | no | impact-analyze |
| fixture | example-empty | update | shared fixture changed | no | impact-analyze |

### Scenario Decision
- update example-smoke

### Fixture Decision
- update example-empty

### Adapter Decision
- reuse adapter memory surface pending review

### Oracle Decision
- reuse oracle value.equals pending review
`,
      "utf8"
    );
    await mkdir(path.join(root, "docs", "superpowers", "plans"), { recursive: true });
    await writeFile(
      path.join(root, "docs", "superpowers", "plans", "build-plan.md"),
      `- Scenario implementation
- Fixture implementation
- Adapter Action implementation
- Inspector implementation
- Oracle implementation
- Harness validation
- Harness scenario execution
`,
      "utf8"
    );

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "hook", "build", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("consumer");
    expect(result.stderr).toContain("example-empty");
  });
});
