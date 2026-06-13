import { execa } from "execa";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];

describe("Part A CLI integration", () => {
  it("initializes, validates, lists, runs, and emits JSON", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-it-"));
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    await execa("pnpm", [...cli, "--root", root, "validate"]);
    const list = await execa("pnpm", [...cli, "--root", root, "scenario", "list"]);
    expect(list.stdout).toContain("example-smoke");
    const run = await execa("pnpm", [...cli, "--root", root, "run", "--scenario", "example-smoke"]);
    expect(run.stdout).toContain("1 passed, 0 failed, 0 error");
    const json = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "--json",
      "run",
      "--scenario",
      "example-smoke"
    ]);
    expect(JSON.parse(json.stdout)).toMatchObject({ schemaVersion: 1, status: "passed" });
  });

  it("returns exit code 1 for blocking oracle failures", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-it-fail-"));
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    const scenarioPath = path.join(root, "harness/scenarios/example-smoke.scenario.yaml");
    const scenario = await readFile(scenarioPath, "utf8");
    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(
        scenarioPath,
        scenario.replace("expected: Hello Harness", "expected: Goodbye Harness")
      )
    );
    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "run", "--scenario", "example-smoke"],
      {
        reject: false
      }
    );
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toContain("FAILED");
  });

  it("reports missing Playwright browser installation in doctor output", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-it-doctor-"));
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "playwright", "--yes"]);
    const result = await execa("pnpm", [...cli, "--root", root, "doctor"]);
    expect(result.stdout).toContain("playwright-browser:chromium");
  });
});
