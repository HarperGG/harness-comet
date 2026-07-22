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
    expect(result.stdout).toContain("playwright-planner");
    expect(result.stdout).toContain("playwright-generator");
    expect(result.stdout).toContain("playwright-healer");
    expect(result.stdout).toContain("playwright-authoring-decision");
  });

  it("keeps playwright-authoring policy-triggered and wired to planner, generator, and healer", async () => {
    const content = await readFile(
      path.resolve("packages/comet-adapter/assets/shared-skills/playwright-authoring/SKILL.md"),
      "utf8"
    );

    expect(content).toContain("project instructions reference `.agents/playwright.md`");
    expect(content).toContain("does not require the user to separately request or approve tests");
    expect(content).toContain("playwright-planner -> playwright-generator -> playwright-healer");
    expect(content).toContain("Invoke `playwright-planner`");
    expect(content).toContain("invoke `playwright-generator`");
    expect(content).toContain("invoke `playwright-healer`");
    expect(content).toContain("every `update` and `create` target was written to the repository");
    expect(content).toContain("every `verify`, `update`, and `create` target was discovered and executed");
    expect(content).toContain("<testDir>/journeys/");
    expect(content).toContain("<testDir>/incidents/");
    expect(content).toContain("<testDir>/data/");
    expect(content).toContain("<testDir>/support/");
  });

  it("keeps the stage skills aligned with mandatory test generation and native verification", async () => {
    const planner = await readFile(
      path.resolve("packages/comet-adapter/assets/shared-skills/playwright-planner/SKILL.md"),
      "utf8"
    );
    expect(planner).toContain("verify | update | create | none");
    expect(planner).toContain("Feature work and bug fixes default to `update` or `create`");
    expect(planner).toContain("<testDir>/journeys/");
    expect(planner).toContain("<testDir>/incidents/");
    expect(planner).toContain("<testDir>/data/");
    expect(planner).toContain("<testDir>/support/");

    const generator = await readFile(
      path.resolve("packages/comet-adapter/assets/shared-skills/playwright-generator/SKILL.md"),
      "utf8"
    );
    expect(generator).toContain("Write the actual repository files");
    expect(generator).toContain("Do not report generation complete when a required file was only described but not written");
    expect(generator).toContain("<testDir>/journeys/");
    expect(generator).toContain("<testDir>/incidents/");
    expect(generator).toContain("<testDir>/data/");
    expect(generator).toContain("<testDir>/support/");

    const healer = await readFile(
      path.resolve("packages/comet-adapter/assets/shared-skills/playwright-healer/SKILL.md"),
      "utf8"
    );
    expect(healer).toContain("pnpm exec playwright test --list");
    expect(healer).toContain("pnpm exec playwright test <target-test-file>");
    expect(healer).toContain("every `verify`, `update`, and `create` target is executed");
    expect(healer).toContain("Do not report success unless every required target was discovered, executed, and passed");
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
      "playwright-generator"
    ]);

    expect(result.stdout).toContain("codex");
    expect(result.stdout).toContain("claude");
    expect(result.stdout).toContain("cursor");
    expect(result.stdout).toContain("github-copilot");

    const codex = await readFile(
      path.join(root, ".codex", "skills", "playwright-generator", "SKILL.md"),
      "utf8"
    );
    const claude = await readFile(
      path.join(root, ".claude", "skills", "playwright-generator", "SKILL.md"),
      "utf8"
    );
    const cursor = await readFile(
      path.join(root, ".cursor", "skills", "playwright-generator", "SKILL.md"),
      "utf8"
    );
    const copilot = await readFile(
      path.join(root, ".github", "skills", "playwright-generator", "SKILL.md"),
      "utf8"
    );
    expect(codex).toContain("name: playwright-generator");
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
        "playwright-generator",
        "--platform",
        "gemini"
      ],
      { reject: false }
    );
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("codex, claude, cursor, and github-copilot");
  });
});
