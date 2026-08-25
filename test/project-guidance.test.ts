import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { execa } from "execa";
import { initializeProjectGuidance } from "../packages/comet-adapter/src/project-guidance.js";

const targets = [
  { entry: "AGENTS.md" },
  { entry: "CLAUDE.md" },
  { entry: ".cursor/rules/harness-comet.mdc" },
  { entry: ".github/copilot-instructions.md" }
];

describe("project guidance initialization", () => {
  it("patches all supported agent entries idempotently with on-demand Playwright guidance", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-"));
    await writeFile(path.join(root, "AGENTS.md"), "# Existing instructions\n", "utf8");

    await initializeProjectGuidance(root);
    await initializeProjectGuidance(root);

    for (const target of targets) {
      const content = await readFile(path.join(root, target.entry), "utf8");
      expect(content).toContain(".agents/rules.md");
      expect(content).toContain(".agents/structure.md");
      expect(content).toContain(".agents/playwright.md");
      expect(content).toContain("playwright-authoring");
      expect(content).toContain("`verify`");
      expect(content).toContain("`update`");
      expect(content).toContain("`create`");
      expect(content).toContain("`none`");
      expect(content).toContain("on demand");
      expect(content).not.toContain("must use that workflow for required Playwright work");
      expect(content).not.toContain("validate-playwright-assets.mjs");
      expect(content.match(/HARNESS-COMET:BEGIN project-context/g)).toHaveLength(1);
    }
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain(
      "# Existing instructions"
    );

    const cursor = await readFile(path.join(root, ".cursor", "rules", "harness-comet.mdc"), "utf8");
    expect(cursor.match(/description: Harness-Comet project knowledge/g)).toHaveLength(1);

    const rules = await readFile(path.join(root, ".agents", "rules.md"), "utf8");
    expect(rules).toContain("Playwright testing");
    expect(rules).toContain("authored on demand");
    expect(rules).toContain("HARNESS-COMET:BEGIN playwright-guidance");
    expect(rules).toContain(".agents/playwright.md");

    const policy = await readFile(path.join(root, ".agents", "playwright.md"), "utf8");
    expect(policy).toContain("Activation policy");
    expect(policy).toContain("Playwright authoring is on demand");
    expect(policy).toContain("HARNESS-COMET:BEGIN playwright-activation");
    expect(policy).toContain("<testDir>/");
    expect(policy).toContain("journeys/");
    expect(policy).toContain("incidents/");
    expect(policy).toContain("data/");
    expect(policy).toContain("support/");
    expect(policy).toContain("pnpm exec playwright test --list");
    expect(policy).toContain("pnpm exec playwright test <target-test-file>");
    expect(policy).not.toContain("Playwright coverage is part of the default delivery");

    const validator = await readFile(
      path.join(root, ".agents", "scripts", "validate-playwright-assets.mjs"),
      "utf8"
    );
    expect(validator).toContain("Playwright asset placement validation passed");
  });

  it("migrates legacy mandatory Playwright guidance in one rerun and preserves surrounding user content", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-migrate-"));
    await mkdir(path.join(root, ".agents"), { recursive: true });
    await writeFile(
      path.join(root, ".agents", "rules.md"),
      "# Project Rules\n\n## Engineering Guidelines\n\n### Playwright testing\n\nWhen work changes user-visible behavior, implements a feature, fixes a bug, changes a business workflow, or may affect existing behavior, read and follow `.agents/playwright.md`.\n\nThe Playwright-specific rules for test generation, asset placement, and verification are defined in `.agents/playwright.md`.\n\n## Team Notes\n\nKeep this user-authored note.\n",
      "utf8"
    );
    await writeFile(
      path.join(root, ".agents", "playwright.md"),
      "# Playwright Testing Policy\n\n## Rule precedence\n\nLegacy rules.\n\n## Default testing obligation\n\nPlaywright coverage is part of the default delivery for feature implementation and bug fixes.\n\n## Trigger conditions\n\nRun for every feature or bug.\n\n## Mandatory workflow\n\nAlways inspect, generate, and execute.\n\n## Test actions\n\n### verify\n\nExisting coverage.\n\n## Project-specific additions\n\nPreserve this custom addition.\n",
      "utf8"
    );
    await writeFile(
      path.join(root, "AGENTS.md"),
      "# User instructions\n\n<!-- HARNESS-COMET:BEGIN project-context -->\n\nold mandatory content\n\n<!-- HARNESS-COMET:END project-context -->\n\n## Custom\nKeep me.\n",
      "utf8"
    );

    await initializeProjectGuidance(root, { agents: ["codex"] });

    const rules = await readFile(path.join(root, ".agents", "rules.md"), "utf8");
    expect(rules).toContain("HARNESS-COMET:BEGIN playwright-guidance");
    expect(rules).toContain("authored on demand");
    expect(rules).toContain("Keep this user-authored note.");
    expect(rules).not.toContain("When work changes user-visible behavior, implements a feature");

    const policy = await readFile(path.join(root, ".agents", "playwright.md"), "utf8");
    expect(policy).toContain("HARNESS-COMET:BEGIN playwright-activation");
    expect(policy).toContain("Playwright authoring is on demand");
    expect(policy).toContain("## Test actions");
    expect(policy).toContain("Preserve this custom addition.");
    expect(policy).not.toContain("Playwright coverage is part of the default delivery");
    expect(policy).not.toContain("## Mandatory workflow");

    const entry = await readFile(path.join(root, "AGENTS.md"), "utf8");
    expect(entry).toContain("# User instructions");
    expect(entry).toContain("## Custom\nKeep me.");
    expect(entry).toContain("Playwright authoring is on demand");
    expect(entry.match(/HARNESS-COMET:BEGIN project-context/g)).toHaveLength(1);
  });

  it("refreshes already-installed Playwright skills without installing missing ones", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-skills-"));
    const authoring = path.join(root, ".codex", "skills", "playwright-authoring", "SKILL.md");
    await mkdir(path.dirname(authoring), { recursive: true });
    await writeFile(authoring, "old mandatory authoring skill\n", "utf8");

    await initializeProjectGuidance(root, { agents: ["codex"] });

    const refreshed = await readFile(authoring, "utf8");
    expect(refreshed).toContain("This skill is on-demand");
    expect(refreshed).toContain("A normal implementation request does not implicitly authorize Playwright authoring");
    await expect(
      stat(path.join(root, ".codex", "skills", "playwright-planner", "SKILL.md"))
    ).rejects.toBeTruthy();
  });

  it("can initialize only selected agent entries", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-selected-"));

    await initializeProjectGuidance(root, { agents: ["codex", "claude"] });

    expect(await readFile(path.join(root, ".agents", "rules.md"), "utf8")).toContain("# Project Rules");
    expect(await readFile(path.join(root, ".agents", "structure.md"), "utf8")).toContain(".agents/playwright.md");
    expect(await readFile(path.join(root, ".agents", "playwright.md"), "utf8")).toContain(
      "# Playwright Testing Policy"
    );
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain(".agents/playwright.md");
    expect(await readFile(path.join(root, "CLAUDE.md"), "utf8")).toContain(".agents/playwright.md");
    await expect(stat(path.join(root, ".cursor", "rules", "harness-comet.mdc"))).rejects.toBeTruthy();
    await expect(stat(path.join(root, ".github", "copilot-instructions.md"))).rejects.toBeTruthy();
  });

  it("rejects unknown selected agents", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-invalid-"));

    await expect(
      initializeProjectGuidance(root, { agents: ["windsurf" as never] })
    ).rejects.toThrow("Unknown project guidance agent");
  });

  it("keeps Chinese guidance when rerunning an existing Chinese project without Comet", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-zh-"));
    await mkdir(path.join(root, ".agents"), { recursive: true });
    await writeFile(
      path.join(root, ".agents", "playwright.md"),
      "# Playwright 测试规则\n\n## 默认测试义务\n\nPlaywright 测试是功能实现和 Bug 修复的默认交付内容。\n\n## 强制工作流\n\n旧规则。\n\n## 测试动作\n\n### verify\n",
      "utf8"
    );

    await initializeProjectGuidance(root, { agents: ["codex"] });

    expect(await readFile(path.join(root, ".agents", "rules.md"), "utf8")).toContain("# 项目规则");
    expect(await readFile(path.join(root, ".agents", "rules.md"), "utf8")).toContain("按需生成");
    expect(await readFile(path.join(root, ".agents", "playwright.md"), "utf8")).toContain("Playwright authoring 按需启用");
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain("项目上下文");
  });

  it("validates Playwright asset placement for generated tests", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-validator-"));
    await initializeProjectGuidance(root);

    await mkdir(path.join(root, "tests", "journeys"), { recursive: true });
    await mkdir(path.join(root, "tests", "incidents"), { recursive: true });
    await mkdir(path.join(root, "tests", "data"), { recursive: true });
    await mkdir(path.join(root, "tests", "support"), { recursive: true });
    await writeFile(path.join(root, "tests", "journeys", "save.spec.ts"), "// journey spec\n", "utf8");
    await writeFile(path.join(root, "tests", "incidents", "INC-1.spec.ts"), "// incident spec\n", "utf8");
    await writeFile(path.join(root, "tests", "data", "save-input.json"), "{}\n", "utf8");
    await writeFile(path.join(root, "tests", "support", "mock-api.ts"), "export {};\n", "utf8");

    const valid = await execa("node", [".agents/scripts/validate-playwright-assets.mjs"], {
      cwd: root
    });
    expect(valid.stdout).toContain("Playwright asset placement validation passed");

    await writeFile(path.join(root, "tests", "loose.spec.ts"), "// misplaced spec\n", "utf8");
    const invalid = await execa("node", [".agents/scripts/validate-playwright-assets.mjs"], {
      cwd: root,
      reject: false
    });
    expect(invalid.exitCode).toBe(1);
    expect(invalid.stderr).toContain("tests/loose.spec.ts");
  });
});
