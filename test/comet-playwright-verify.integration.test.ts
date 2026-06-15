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

- Mode: maintain
- Reason: same contract should stay inside existing assets
- Affected capabilities:
  - component: example | capability: render-page | behavior: show-page | risk: low
- Existing Playwright assets:
  - path: tests/example.spec.ts | relation: same-contract
- Preliminary decision: update

## Harness Playwright Design

- Mode: maintain
- Decision: update
- Decision Reason: same contract, no new asset should be required
- Target tests:
  - path: tests/new-flow.spec.ts | scenarioId: new-flow | action: update | reason: incorrectly added new file
- Related files:
  - path: playwright.config.ts | reason: unchanged
- Verification commands:
  - pnpm exec playwright test tests/new-flow.spec.ts
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
      `import { defineHarnessScenario } from "@harness-comet/playwright";
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
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Maintain mode cannot create new Playwright assets"
    );
    expect(`${result.stdout}\n${result.stderr}`).toContain("tests/new-flow.spec.ts");
  });
});
