import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const assetsRoot = path.resolve(
  "packages/comet-adapter/assets/comet-skills/playwright"
);

async function readManagedBuild(language: "en" | "zh"): Promise<string> {
  return readFile(
    path.join(assetsRoot, language, "comet-build", "SKILL.md"),
    "utf8"
  );
}

describe("managed comet-build assets", () => {
  it("preserves upstream Build workflow constraints in English", async () => {
    const skill = await readManagedBuild("en");

    expect(skill).toContain("Create Plan (Subagent Offload)");
    expect(skill).toContain("Plan-Ready Pause Point");
    expect(skill).toContain("Select Workflow Configuration");
    expect(skill).toContain("subagent_dispatch confirmed");
    expect(skill).toContain("test-driven-development");
    expect(skill).toContain("requesting-code-review");
    expect(skill).toContain("In-Execution Debugging");
    expect(skill).toContain("50%");
    expect(skill).toContain("dirty-worktree.md");
    expect(skill).toContain("build_command");
    expect(skill).toContain("Automatic Handoff to Next Phase");
  });

  it("keeps Harness and Playwright Build behavior in English", async () => {
    const skill = await readManagedBuild("en");

    expect(skill).toContain("Playwright Authoring Execution");
    expect(skill).toContain("playwright-authoring-build");
    expect(skill).toContain("Playwright Authoring Verification and Harness Gate");
    expect(skill).toContain("playwright-authoring-verify");
    expect(skill).toContain("verify`, `update`, `create`, `retire`, `ignore");
    expect(skill).toContain("harness-comet comet hook build --change");
    expect(skill).toContain("Do not edit `.harness-comet/manifest.json`");
  });

  it("provides an equivalent official-Chinese managed Build workflow", async () => {
    const skill = await readManagedBuild("zh");

    expect(skill).toContain("制定计划（Subagent Offload）");
    expect(skill).toContain("plan-ready 暂停点");
    expect(skill).toContain("选择工作方式");
    expect(skill).toContain("subagent_dispatch confirmed");
    expect(skill).toContain("执行中异常调试（Debug Gate）");
    expect(skill).toContain("Playwright 编写实施");
    expect(skill).toContain("playwright-authoring-build");
    expect(skill).toContain("Playwright 编写验证与 Harness Gate");
    expect(skill).toContain("playwright-authoring-verify");
    expect(skill).toContain("harness-comet comet hook build --change");
    expect(skill).toContain("自动衔接下一阶段");
  });
});
