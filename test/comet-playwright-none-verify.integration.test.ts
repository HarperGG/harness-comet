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
  await execa("git", ["add", "."], { cwd: root });
  await execa("git", ["commit", "--allow-empty", "-m", "init"], { cwd: root });
}

describe("comet playwright verify action none", () => {
  it("writes a not-applicable v2 receipt without running playwright", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "comet-pw-verify-none-"));
    await initGitRepo(root);
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
    await writeFile(path.join(root, "package.json"), JSON.stringify({ packageManager: "npm@10.8.2" }, null, 2));
    await writeFile(path.join(root, "playwright.config.ts"), "export default {};\n", "utf8");
    await mkdir(path.join(root, "openspec", "changes", "demo-change"), { recursive: true });
    await writeFile(
      path.join(root, "openspec", "changes", "demo-change", ".comet.yaml"),
      "phase: verify\ndesign_doc: design.md\nverify_result: pass\n",
      "utf8"
    );
    await writeFile(
      path.join(root, "openspec", "changes", "demo-change", "design.md"),
      `## Harness Playwright Impact

- Action: none
- Reason: no harness changes required
- Confirmed by: user

## Harness Playwright Plan

- Action: none
- Reason: skip playwright changes
`,
      "utf8"
    );
    await execa("git", ["add", "."], { cwd: root });
    await execa("git", ["commit", "-m", "add change"], { cwd: root });

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "verify",
      "--change",
      "demo-change"
    ]);

    expect(result.exitCode).toBe(0);
    const receipt = JSON.parse(
      await readFile(
        path.join(root, "openspec", "changes", "demo-change", ".comet", "harness", "verify-receipt.json"),
        "utf8"
      )
    );
    expect(receipt).toMatchObject({
      schemaVersion: 2,
      action: "none",
      status: "not-applicable",
      targetTests: [],
      resultsPath: "not-applicable"
    });
  });
});
