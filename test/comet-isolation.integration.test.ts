import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { execa } from "execa";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];

describe("comet isolation", () => {
  it("keeps Part A commands working without Comet", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "comet-isolation-"));
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    const validate = await execa("pnpm", [...cli, "--root", root, "validate"]);
    const run = await execa("pnpm", [...cli, "--root", root, "run", "--scenario", "example-smoke"]);
    expect(validate.stdout).toContain("Harness assets are valid");
    expect(run.stdout).toContain("1 passed, 0 failed, 0 error");
  });

  it("keeps Part A commands separate from comet command failure", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "comet-isolation-fail-"));
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    const comet = await execa("pnpm", [...cli, "--root", root, "comet", "doctor"], {
      reject: false,
      env: { HARNESS_COMET_COMET_BIN: path.join(tmpdir(), "missing-comet") }
    });
    const run = await execa("pnpm", [...cli, "--root", root, "run", "--scenario", "example-smoke"]);
    expect(comet.exitCode).toBe(6);
    expect(run.stdout).toContain("1 passed, 0 failed, 0 error");
  });
});
