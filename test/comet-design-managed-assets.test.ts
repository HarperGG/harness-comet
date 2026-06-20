import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const assetsRoot = path.resolve(
  "packages/comet-adapter/assets/comet-skills/playwright"
);

async function readManagedDesign(language: "en" | "zh"): Promise<string> {
  return readFile(
    path.join(assetsRoot, language, "comet-design", "SKILL.md"),
    "utf8"
  );
}

describe("managed comet-design assets", () => {
  it("preserves upstream Design workflow constraints in English", async () => {
    const skill = await readManagedDesign("en");

    expect(skill).toContain("Generate OpenSpec → Superpowers Handoff Package");
    expect(skill).toContain("Execute Brainstorming (with Context)");
    expect(skill).toContain("User Confirms Design Proposal (Blocking Point)");
    expect(skill).toContain("Brainstorming Checkpoint Finalization");
    expect(skill).toContain("Active Context Compaction Gate");
    expect(skill).toContain("resolved");
    expect(skill).toContain("Spec Patches");
    expect(skill).toContain("Context Compression Recovery");
    expect(skill).toContain("Automatic Handoff to Next Phase");
  });

  it("keeps Harness and Playwright Design behavior in English", async () => {
    const skill = await readManagedDesign("en");

    expect(skill).toContain("Playwright Authoring Plan");
    expect(skill).toContain("playwright-authoring-plan");
    expect(skill).toContain("verify`, `update`, `create`, `retire`, `ignore");
    expect(skill).toContain("Do not modify Playwright assets during Design");
    expect(skill).toContain("harness-comet comet hook design --change");
    expect(skill).toContain("Do not edit `.harness-comet/manifest.json`");
  });

  it("provides an equivalent official-Chinese managed Design workflow", async () => {
    const skill = await readManagedDesign("zh");

    expect(skill).toContain("生成 OpenSpec → Superpowers 交接包");
    expect(skill).toContain("执行 Brainstorming（带上下文）");
    expect(skill).toContain("用户确认设计方案（阻塞点）");
    expect(skill).toContain("Brainstorming 检查点定稿");
    expect(skill).toContain("主动上下文压缩门");
    expect(skill).toContain("Playwright 编写规划");
    expect(skill).toContain("playwright-authoring-plan");
    expect(skill).toContain("harness-comet comet hook design --change");
    expect(skill).toContain("自动衔接下一阶段");
  });
});
