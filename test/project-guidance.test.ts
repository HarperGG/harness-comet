import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initializeProjectGuidance } from "../packages/comet-adapter/src/project-guidance.js";

const targets = [
  { skillRoot: ".codex/skills", entry: "AGENTS.md" },
  { skillRoot: ".claude/skills", entry: "CLAUDE.md" },
  { skillRoot: ".cursor/skills", entry: ".cursor/rules/harness-comet.mdc" },
  { skillRoot: ".github/skills", entry: ".github/copilot-instructions.md" }
];

describe("project guidance initialization", () => {
  it("patches all supported agent entries idempotently", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-"));
    for (const target of targets) {
      await mkdir(path.join(root, target.skillRoot, "comet-archive"), { recursive: true });
      await writeFile(
        path.join(root, target.skillRoot, "comet-archive", "SKILL.md"),
        "# archive\n",
        "utf8"
      );
    }
    await mkdir(path.join(root, ".codex", "skills", "comet-open"), { recursive: true });
    await writeFile(path.join(root, ".codex", "skills", "comet-open", "SKILL.md"), "# Open\n", "utf8");
    await writeFile(path.join(root, "AGENTS.md"), "# Existing instructions\n", "utf8");

    await initializeProjectGuidance(root);
    await initializeProjectGuidance(root);

    for (const target of targets) {
      const content = await readFile(path.join(root, target.entry), "utf8");
      expect(content).toContain(".agents/rules.md");
      expect(content).toContain(".agents/structure.md");
      expect(content.match(/HARNESS-COMET:BEGIN project-context/g)).toHaveLength(1);
    }
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain(
      "# Existing instructions"
    );
  });

  it("uses Chinese templates when Comet selects Chinese", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-zh-"));
    await mkdir(path.join(root, ".codex", "skills", "comet-archive"), { recursive: true });
    await writeFile(
      path.join(root, ".codex", "skills", "comet-archive", "SKILL.md"),
      "# archive\n",
      "utf8"
    );
    await mkdir(path.join(root, ".comet"), { recursive: true });
    await writeFile(path.join(root, ".comet", "config.yaml"), "language: zh\n", "utf8");

    await initializeProjectGuidance(root);

    expect(await readFile(path.join(root, ".agents", "rules.md"), "utf8")).toContain("# 项目规则");
    expect(await readFile(path.join(root, ".agents", "structure.md"), "utf8")).toContain(
      "# 项目结构"
    );
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain("项目上下文");
  });
});
