import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { execa } from "execa";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];

describe("standalone skill installer", () => {
  it("lists skills from the packaged shared catalog", async () => {
    const result = await execa("pnpm", [...cli, "skill", "list"]);
    expect(result.stdout).toContain("playwright-authoring");
    expect(result.stdout).toContain("playwright-authoring-decision");
  });

  it("installs one skill into detected Codex, Claude, Cursor, and Copilot projects", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-skill-install-"));
    await mkdir(path.join(root, ".codex"), { recursive: true });
    await mkdir(path.join(root, ".claude"), { recursive: true });
    await mkdir(path.join(root, ".cursor"), { recursive: true });
    await mkdir(path.join(root, ".github"), { recursive: true });

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "skill",
      "install",
      "playwright-authoring-decision"
    ]);

    expect(result.stdout).toContain("codex");
    expect(result.stdout).toContain("claude");
    expect(result.stdout).toContain("cursor");
    expect(result.stdout).toContain("github-copilot");

    const codex = await readFile(
      path.join(root, ".codex", "skills", "playwright-authoring-decision", "SKILL.md"),
      "utf8"
    );
    const claude = await readFile(
      path.join(root, ".claude", "skills", "playwright-authoring-decision", "SKILL.md"),
      "utf8"
    );
    const cursor = await readFile(
      path.join(root, ".cursor", "skills", "playwright-authoring-decision", "SKILL.md"),
      "utf8"
    );
    const copilot = await readFile(
      path.join(root, ".github", "skills", "playwright-authoring-decision", "SKILL.md"),
      "utf8"
    );
    expect(codex).toContain("name: playwright-authoring-decision");
    expect(claude).toBe(codex);
    expect(cursor).toBe(codex);
    expect(copilot).toBe(codex);
  });

  it("rejects unsupported standalone installation platforms", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-skill-platform-"));
    const result = await execa(
      "pnpm",
      [
        ...cli,
        "--root",
        root,
        "skill",
        "install",
        "playwright-authoring-decision",
        "--platform",
        "gemini"
      ],
      { reject: false }
    );

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("codex, claude, cursor, and github-copilot");
  });
});
