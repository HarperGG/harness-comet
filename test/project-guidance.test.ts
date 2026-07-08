import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initializeProjectGuidance } from "../packages/comet-adapter/src/project-guidance.js";

const targets = [
  { entry: "AGENTS.md" },
  { entry: "CLAUDE.md" },
  { entry: ".cursor/rules/harness-comet.mdc" },
  { entry: ".github/copilot-instructions.md" }
];

describe("project guidance initialization", () => {
  it("patches all supported agent entries idempotently without requiring skills", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-"));
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
    await mkdir(path.join(root, ".comet"), { recursive: true });
    await writeFile(path.join(root, ".comet", "config.yaml"), "language: zh\n", "utf8");

    await initializeProjectGuidance(root);

    expect(await readFile(path.join(root, ".agents", "rules.md"), "utf8")).toContain("# 项目规则");
    expect(await readFile(path.join(root, ".agents", "structure.md"), "utf8")).toContain(
      "# 项目结构"
    );
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain("项目上下文");
    expect(await readFile(path.join(root, "CLAUDE.md"), "utf8")).toContain("项目上下文");
  });
});
