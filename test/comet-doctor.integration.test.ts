import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execa } from "execa";
import { REQUIRED_SKILL_ROOT_FILES } from "../packages/comet-adapter/src/compatibility/file-contract.js";

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

async function seedSkillRoot(projectRoot: string, rootPath: string, full = true): Promise<void> {
  const files = full
    ? REQUIRED_SKILL_ROOT_FILES
    : REQUIRED_SKILL_ROOT_FILES.filter((item) => item !== "comet-verify/SKILL.md");
  for (const relativePath of files) {
    const fullPath = path.join(projectRoot, rootPath, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, "stub\n", "utf8");
  }
}

describe("comet doctor integration", () => {
  it("returns exit 6 when Comet is missing", async () => {
    process.env.HARNESS_COMET_COMET_BIN = path.join(tmpdir(), "missing-comet");
    const root = await mkdtemp(path.join(tmpdir(), "comet-missing-"));
    const result = await execa("pnpm", [...cli, "--root", root, "comet", "doctor"], {
      reject: false
    });
    expect(result.exitCode).toBe(6);
    expect(result.stdout).toContain("installed=false");
  });

  it("returns exit 0 for compatible Comet with zero targets", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-zero-targets-"));
    const result = await execa("pnpm", [...cli, "--root", root, "comet", "doctor"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("TARGETS 0");
  });

  it("reports invalid targets without failing the command", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-invalid-target-"));
    await mkdir(path.join(root, ".cursor"), { recursive: true });
    await seedSkillRoot(root, ".cursor/skills", false);
    const result = await execa("pnpm", [...cli, "--root", root, "comet", "doctor"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("TARGET cursor valid=false");
    expect(result.stdout).toContain("required-file-missing");
  });
});
