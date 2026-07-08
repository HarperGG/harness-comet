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
  it("patches all supported agent entries idempotently without requiring skills", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-"));
    await writeFile(path.join(root, "AGENTS.md"), "# Existing instructions\n", "utf8");

    await initializeProjectGuidance(root);
    await initializeProjectGuidance(root);

    for (const target of targets) {
      const content = await readFile(path.join(root, target.entry), "utf8");
      expect(content).toContain(".agents/rules.md");
      expect(content).toContain(".agents/structure.md");
      expect(content).toContain("validate-playwright-assets.mjs");
      expect(content.match(/HARNESS-COMET:BEGIN project-context/g)).toHaveLength(1);
    }
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain(
      "# Existing instructions"
    );

    const rules = await readFile(path.join(root, ".agents", "rules.md"), "utf8");
    expect(rules).toContain("Playwright test asset rules");
    expect(rules).toContain("node .agents/scripts/validate-playwright-assets.mjs");

    const validator = await readFile(
      path.join(root, ".agents", "scripts", "validate-playwright-assets.mjs"),
      "utf8"
    );
    expect(validator).toContain("Playwright asset placement validation passed");
  });

  it("can initialize only selected agent entries", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-selected-"));

    await initializeProjectGuidance(root, { agents: ["codex", "claude"] });

    expect(await readFile(path.join(root, ".agents", "rules.md"), "utf8")).toContain("# Project Rules");
    expect(await readFile(path.join(root, ".agents", "structure.md"), "utf8")).toContain("validate-playwright-assets.mjs");
    expect(await readFile(path.join(root, ".agents", "scripts", "validate-playwright-assets.mjs"), "utf8")).toContain(
      "Playwright asset placement validation passed"
    );
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain(".agents/rules.md");
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain("validate-playwright-assets.mjs");
    expect(await readFile(path.join(root, "CLAUDE.md"), "utf8")).toContain(".agents/rules.md");
    expect(await readFile(path.join(root, "CLAUDE.md"), "utf8")).toContain("validate-playwright-assets.mjs");
    await expect(stat(path.join(root, ".cursor", "rules", "harness-comet.mdc"))).rejects.toBeTruthy();
    await expect(stat(path.join(root, ".github", "copilot-instructions.md"))).rejects.toBeTruthy();
  });

  it("rejects unknown selected agents", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-invalid-"));

    await expect(
      initializeProjectGuidance(root, { agents: ["windsurf" as never] })
    ).rejects.toThrow("Unknown project guidance agent");
  });

  it("uses Chinese templates when Comet selects Chinese", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-zh-"));
    await mkdir(path.join(root, ".comet"), { recursive: true });
    await writeFile(path.join(root, ".comet", "config.yaml"), "language: zh\n", "utf8");

    await initializeProjectGuidance(root);

    expect(await readFile(path.join(root, ".agents", "rules.md"), "utf8")).toContain("# 项目规则");
    expect(await readFile(path.join(root, ".agents", "rules.md"), "utf8")).toContain("Playwright 测试资产规则");
    expect(await readFile(path.join(root, ".agents", "structure.md"), "utf8")).toContain(
      "# 项目结构"
    );
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain("项目上下文");
    expect(await readFile(path.join(root, "AGENTS.md"), "utf8")).toContain("validate-playwright-assets.mjs");
    expect(await readFile(path.join(root, "CLAUDE.md"), "utf8")).toContain("项目上下文");
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
