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
  return "## Harness-Comet Project Context\n\nRead before changing code:\n\n- Project red lines and engineering guidelines: `.agents/rules.md`\n- Project structure and module responsibilities: `.agents/structure.md`\n\nWhen work implements a feature, changes user-visible behavior, fixes a bug or production issue, changes an application workflow, or may affect existing behavior, also read and follow `.agents/playwright.md`. These trigger conditions apply even when the user asks only for implementation and does not explicitly request tests.\n\nWhen the `playwright-authoring` skill is available, use it for the required Playwright work. If it is unavailable, directly follow the same impact analysis, asset generation, and native verification workflow defined in `.agents/playwright.md`.\n\nBefore completion, select `verify`, `update`, `create`, or `none`, and run the required native Playwright commands. Do not report completion when required tests were not created, were not discovered, failed, or could not run. Playwright-specific rules are defined by `.agents/playwright.md`.";
}

function chineseBody(): string {
  return "## Harness-Comet 项目上下文\n\n修改代码前请阅读：\n\n- 项目红线和工程准则：`.agents/rules.md`\n- 项目结构和模块职责：`.agents/structure.md`\n\n当任务涉及实现新功能、修改用户可感知行为、修复 Bug 或生产问题、修改业务流程，或进行可能影响现有行为的重构时，还必须读取并遵循 `.agents/playwright.md`。即使用户只要求实现代码、没有明确要求测试，这些触发条件仍然适用。\n\n当 `playwright-authoring` skill 可用时，必须使用该工作流完成所需的 Playwright 工作。skill 不可用时，也必须直接按照 `.agents/playwright.md` 完成相同的影响分析、测试资产生成和原生验证。\n\n完成前必须明确选择 `verify`、`update`、`create` 或 `none`，并执行要求的原生 Playwright 命令。没有创建必要测试、测试未被发现、目标测试失败或验证无法执行时，不得报告任务完成。Playwright 专项规则以 `.agents/playwright.md` 为准。";
}
