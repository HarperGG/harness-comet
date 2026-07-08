import type { GuidanceLanguage } from "./project-guidance-templates.js";

export const GUIDANCE_START = "<!-- HARNESS-COMET:BEGIN project-context -->";
export const GUIDANCE_END = "<!-- HARNESS-COMET:END project-context -->";

export function renderGuidanceEntry(
  platformId: string,
  language: GuidanceLanguage
): string {
  const frontmatter = platformId === "cursor"
    ? "---\ndescription: Harness-Comet project knowledge\nalwaysApply: true\n---\n\n"
    : "";
  const body = language === "zh" ? chineseBody() : englishBody();
  return `${frontmatter}${GUIDANCE_START}\n\n${body}\n\n${GUIDANCE_END}`;
}

function englishBody(): string {
  return "## Harness-Comet Project Context\n\nRead before changing code:\n\n- Project red lines and engineering guidelines: `.agents/rules.md`\n- Project structure and module responsibilities: `.agents/structure.md`\n\nRespect all project red lines. Feature and bug changes should follow the Comet workflow and complete required Harness-Comet verification.\n\nIf you create, update, move, or delete Playwright test assets, run `node .agents/scripts/validate-playwright-assets.mjs` before reporting completion. Passing this command means the generated Playwright assets follow the project placement model; it does not prove business coverage quality.";
}

function chineseBody(): string {
  return "## Harness-Comet 项目上下文\n\n修改代码前请阅读：\n\n- 项目红线和工程准则：`.agents/rules.md`\n- 项目结构和模块职责：`.agents/structure.md`\n\n必须遵守项目红线。需求、功能和 Bug 修改应遵循 Comet 工作流，并完成 Harness-Comet 要求的验证。\n\n如果创建、更新、移动或删除了 Playwright 测试资产，交付前必须运行 `node .agents/scripts/validate-playwright-assets.mjs`。该命令通过表示生成的 Playwright 测试资产符合项目放置模型，但不代表业务覆盖质量已被证明。";
}
