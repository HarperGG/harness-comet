import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const assetsRoot = path.resolve(
  "packages/comet-adapter/assets/comet-skills/playwright"
);

async function readManagedOpen(language: "en" | "zh"): Promise<string> {
  return readFile(
    path.join(assetsRoot, language, "comet-open", "SKILL.md"),
    "utf8"
  );
}

describe("managed comet-open assets", () => {
  it("preserves upstream Open workflow constraints in English", async () => {
    const skill = await readManagedOpen("en");

    expect(skill).toContain("PRD Split Preflight (Blocking Point)");
    expect(skill).toContain("Requirements Clarification Completion Confirmation");
    expect(skill).toContain("Change Name Confirmation (Blocking Point)");
    expect(skill).toContain("Standard artifact loop");
    expect(skill).toContain("resolvedOutputPath");
    expect(skill).toContain("Idempotency:");
    expect(skill).toContain("Automatic Handoff to Next Phase");
    expect(skill).toContain("NEXT: auto");
  });

  it("keeps Harness and Playwright Open behavior in English", async () => {
    const skill = await readManagedOpen("en");

    expect(skill).toContain("Playwright Impact Analysis");
    expect(skill).toContain("playwright-impact-analysis");
    expect(skill).toContain("playwright-authoring-decision");
    expect(skill).toContain("verify`, `update`, `create`, `retire`, or `ignore");
    expect(skill).toContain("harness-comet comet hook open --change");
    expect(skill).toContain("Do not edit `.harness-comet/manifest.json`");
  });

  it("provides an equivalent Chinese managed Open workflow", async () => {
    const skill = await readManagedOpen("zh");

    expect(skill).toContain("PRD 拆分预检（阻塞点）");
    expect(skill).toContain("需求澄清完成确认（阻塞点）");
    expect(skill).toContain("Change 名称确认（阻塞点）");
    expect(skill).toContain("标准 artifact 循环");
    expect(skill).toContain("幂等性：");
    expect(skill).toContain("Playwright 影响分析");
    expect(skill).toContain("playwright-authoring-decision");
    expect(skill).toContain("harness-comet comet hook open --change");
    expect(skill).toContain("自动交接到下一阶段");
  });
});
