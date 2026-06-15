import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { execa } from "execa";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];

async function createChange(root: string, change: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    "phase: open\ndesign_doc: design.md\n",
    "utf8"
  );
  await writeFile(path.join(changeRoot, "design.md"), "# Demo change\n", "utf8");
}

async function createRootRelativeChange(root: string, change: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    `phase: open\ndesign_doc: openspec/changes/${change}/design.md\n`,
    "utf8"
  );
  await writeFile(path.join(changeRoot, "design.md"), "# Demo change\n", "utf8");
}

async function createPlaywrightConfig(root: string): Promise<void> {
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
}

describe("impact command integration", () => {
  it("sets and shows Harness impact mode for a Comet change", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "impact-command-"));
    await createChange(root, "demo-change");

    const setResult = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "impact",
      "set",
      "--change",
      "demo-change",
      "--mode",
      "maintain",
      "--reason",
      "copy-only update"
    ]);

    expect(setResult.exitCode).toBe(0);
    expect(setResult.stdout).toContain("MODE maintain");

    const design = await readFile(path.join(root, "openspec", "changes", "demo-change", "design.md"), "utf8");
    expect(design).toContain("## Harness Impact");
    expect(design).toContain("- Mode: maintain");
    expect(design).toContain("- Reason: copy-only update");

    const showResult = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "impact",
      "show",
      "--change",
      "demo-change"
    ]);

    expect(showResult.exitCode).toBe(0);
    expect(showResult.stdout).toContain("CHANGE demo-change");
    expect(showResult.stdout).toContain("MODE maintain");
    expect(showResult.stdout).toContain("REASON copy-only update");
  });

  it("resolves root-relative Comet design_doc paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "impact-root-relative-"));
    await createRootRelativeChange(root, "demo-change");

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "impact",
      "set",
      "--change",
      "demo-change",
      "--mode",
      "maintain",
      "--reason",
      "root relative design doc"
    ]);

    expect(result.exitCode).toBe(0);
    const design = await readFile(path.join(root, "openspec", "changes", "demo-change", "design.md"), "utf8");
    expect(design).toContain("## Harness Impact");
    expect(design).toContain("- Reason: root relative design doc");
  });

  it("sets Playwright impact for Playwright mode projects", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "impact-playwright-"));
    await createPlaywrightConfig(root);
    await createChange(root, "demo-change");

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "impact",
      "set",
      "--change",
      "demo-change",
      "--action",
      "verify-existing",
      "--reason",
      "existing playwright coverage only",
      "--confirmed-by",
      "user"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("ACTION verify-existing");
    expect(result.stdout).toContain("CONFIRMED_BY user");
    const design = await readFile(path.join(root, "openspec", "changes", "demo-change", "design.md"), "utf8");
    expect(design).toContain("## Harness Playwright Impact");
    expect(design).toContain("- Action: verify-existing");
    expect(design).toContain("- Reason: existing playwright coverage only");
    expect(design).toContain("- Confirmed by: user");
    expect(design).not.toContain("## Harness Impact");
  });

  it("does not expose analyze as part of the impact protocol CLI", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "impact-no-analyze-"));
    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "impact", "analyze"],
      { reject: false }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("unknown command");
    expect(result.stderr).toContain("analyze");
  });
});
