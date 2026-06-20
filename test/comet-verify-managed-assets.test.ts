import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve("packages/comet-adapter/assets/comet-skills/playwright");

async function readSkill(language: "en" | "zh") {
  return readFile(path.join(root, language, "comet-verify", "SKILL.md"), "utf8");
}

describe("managed comet-verify assets", () => {
  it("keeps upstream and Harness verification in English", async () => {
    const skill = await readSkill("en");
    for (const marker of [
      "Scale Assessment",
      "Verification Failure Decision (Blocking Point)",
      "Artifact Context Loading (Hash On-Demand Read)",
      "Lightweight Verification",
      "Full Verification",
      "Spec Drift Decision",
      "finishing-a-development-branch",
      "Harness/Playwright Change Verification",
      "harness-comet comet verify --change",
      "explicit not-applicable receipt",
      "Automatic Handoff to Next Phase"
    ]) {
      expect(skill).toContain(marker);
    }
  });

  it("keeps equivalent Chinese verification", async () => {
    const skill = await readSkill("zh");
    for (const marker of [
      "改动规模评估",
      "验证失败决策（阻塞点）",
      "产物上下文加载（Hash 按需读）",
      "轻量验证（小改动）",
      "完整验证（大改动）",
      "Spec 漂移决策",
      "Harness/Playwright Change 验证",
      "harness-comet comet verify --change",
      "not-applicable receipt",
      "自动衔接下一阶段"
    ]) {
      expect(skill).toContain(marker);
    }
  });
});
