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

async function createChange(root: string, change: string, mode: "full" | "maintain"): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(path.join(changeRoot, ".comet.yaml"), "phase: build\ndesign_doc: design.md\nverify_result: pass\n", "utf8");
  await writeFile(path.join(changeRoot, "tasks.md"), "- Harness task: evaluate playwright assets\n", "utf8");
  await writeFile(
    path.join(changeRoot, "design.md"),
    `## Harness Playwright Impact

- Action: ${mode === "full" ? "update-or-create" : "verify-existing"}
- Reason: ${mode === "full" ? "new independent behavior requires a new path" : "same contract should stay inside existing assets"}
- Confirmed by: user
- Reviewed existing tests:
  - tests/example.spec.ts

## Harness Playwright Plan

- Action: ${mode === "full" ? "update-or-create" : "verify-existing"}

### Target tests

- path: tests/new-flow.spec.ts | operation: ${mode === "full" ? "create" : "update"} | reason: ${mode === "full" ? "new independent business behavior" : "incorrectly added new file"}

### Related test assets

- path: playwright.config.ts | reason: unchanged

### Expected evidence

- playwright test tests/new-flow.spec.ts
`,
    "utf8"
  );
}

describe("comet playwright impact mode enforcement", () => {
  it("build hook rejects a new spec in maintain mode", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "comet-pw-maintain-build-"));
    await createPlaywrightProject(root);
    await createChange(root, "demo-change", "maintain");
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
      [...cli, "--root", root, "comet", "hook", "build", "--change", "demo-change"],
      { reject: false }
    );

    expect(result.exitCode).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain(
      "Action verify-existing cannot create new Playwright assets"
    );
    expect(`${result.stdout}\n${result.stderr}`).toContain("tests/new-flow.spec.ts");
  });

  it("build hook allows a new spec in full mode", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "comet-pw-full-build-"));
    await createPlaywrightProject(root);
    await createChange(root, "demo-change", "full");
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
