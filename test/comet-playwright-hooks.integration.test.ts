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
  await writeFile(path.join(root, "playwright.config.ts"), "export default {};\n", "utf8");
  await writeFile(
    path.join(root, "tests", "example.spec.ts"),
    `import { defineHarnessScenario } from "@harness-comet/playwright";
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

async function createPlaywrightChange(root: string, change: string): Promise<void> {
  await createPlaywrightChangeWithDoc(
    root,
    change,
    `## Harness Playwright Impact

- Mode: maintain
- Reason: existing business contract still applies
- Affected capabilities:
  - component: example | capability: render-page | behavior: show-page | risk: low
- Existing Playwright assets:
  - path: tests/example.spec.ts | relation: same-contract
- Preliminary decision: update

## Harness Playwright Design

- Mode: maintain
- Decision: update
- Decision Reason: same contract with a small UI adjustment
- Target tests:
  - path: tests/example.spec.ts | scenarioId: example-smoke | action: update | reason: same contract
- Related files:
  - path: playwright.config.ts | reason: config remains unchanged
- Verification commands:
  - pnpm exec playwright test tests/example.spec.ts
`
  );
}

async function createPlaywrightChangeWithDoc(
  root: string,
  change: string,
  designDoc: string
): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(path.join(changeRoot, ".comet.yaml"), "phase: open\ndesign_doc: design.md\nverify_result: pass\n", "utf8");
  await writeFile(
    path.join(changeRoot, "tasks.md"),
    "- Harness task: update Playwright scenario coverage\n",
    "utf8"
  );
  await writeFile(
    path.join(changeRoot, "design.md"),
    designDoc,
    "utf8"
  );
}

describe("comet playwright hook integration", () => {
  it("open hook validates Harness Playwright Impact", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "comet-pw-open-"));
    await createPlaywrightProject(root);
    await createPlaywrightChange(root, "demo-change");

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
  });

  it("design hook validates Harness Playwright Design", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "comet-pw-design-"));
    await createPlaywrightProject(root);
    await createPlaywrightChange(root, "demo-change");

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
  });

  it("design hook rejects create decision in maintain mode", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "comet-pw-design-create-"));
    await createPlaywrightProject(root);
    await createPlaywrightChangeWithDoc(
      root,
      "demo-change",
      `## Harness Playwright Impact

- Mode: maintain
- Reason: same contract still applies
- Affected capabilities:
  - component: example | capability: render-page | behavior: show-page | risk: low
- Existing Playwright assets:
  - path: tests/example.spec.ts | relation: same-contract
- Preliminary decision: update

## Harness Playwright Design

- Mode: maintain
- Decision: create
- Decision Reason: adding a convenient new regression test
- Target tests:
  - path: tests/new-flow.spec.ts | scenarioId: new-flow | action: create | reason: convenience coverage
- Related files:
  - path: playwright.config.ts | reason: config remains unchanged
- Verification commands:
  - pnpm exec playwright test tests/new-flow.spec.ts
`
    );

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "hook", "design", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "cannot create new test assets"
    );
  });

  it("open hook rejects off mode for an onboarded Playwright project", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "comet-pw-open-off-"));
    await createPlaywrightProject(root);
    await createPlaywrightChangeWithDoc(
      root,
      "demo-change",
      `## Harness Playwright Impact

- Mode: off
- Reason: agent believes no harness changes are required
- Affected capabilities:
  - component: example | capability: render-page | behavior: show-page | risk: low
- Existing Playwright assets:
  - path: tests/example.spec.ts | relation: same-contract
- Preliminary decision: none

## Harness Playwright Design

- Mode: off
- Decision: none
- Decision Reason: skip playwright changes
- Target tests:
  - path: tests/example.spec.ts | scenarioId: example-smoke | action: reuse | reason: unchanged
- Related files:
  - path: playwright.config.ts | reason: unchanged
- Verification commands:
  - pnpm exec playwright test tests/example.spec.ts
`
    );

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "hook", "open", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "mode off is not allowed for an onboarded Harness project"
    );
  });

  it("build hook validates target tests and metadata", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "comet-pw-build-"));
    await createPlaywrightProject(root);
    await createPlaywrightChange(root, "demo-change");

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
  });
});
