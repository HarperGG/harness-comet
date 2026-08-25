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
  return "## Harness-Comet Project Context\n\nBefore changing code, read:\n\n- Project red lines and engineering guidelines: `.agents/rules.md`\n- Project structure and module responsibilities: `.agents/structure.md`\n\nPlaywright authoring is on demand during normal development. A feature request, bug fix, refactor, or user-visible behavior change does not by itself require Playwright coverage analysis, asset generation, or execution. Do not read `.agents/playwright.md` solely because production code changed, do not automatically select `verify`, `update`, `create`, or `none`, and do not block normal implementation on Playwright coverage.\n\nIf a completed change affects user-visible behavior and the user did not request Playwright work, you may mention once at completion that Playwright regression coverage can be added with `playwright-authoring`. Do not repeatedly ask during implementation.\n\nOnly when the user explicitly requests Playwright, E2E, browser, or regression-test work, asks for Playwright coverage analysis, or invokes a Playwright skill: read `.agents/playwright.md`; use `playwright-impact-analysis` for read-only coverage analysis; use `playwright-authoring` when assets should be verified, updated, created, or repaired.";
}

function chineseBody(): string {
  return "## Harness-Comet 项目上下文\n\n修改代码前请阅读：\n\n- 项目红线和工程准则：`.agents/rules.md`\n- 项目结构和模块职责：`.agents/structure.md`\n\n日常研发中的 Playwright authoring 按需启用。功能需求、Bug 修复、重构或用户可感知行为修改本身，不要求自动做 Playwright 覆盖分析、测试资产生成或执行。不要仅因为生产代码发生变化就读取 `.agents/playwright.md`，不要自动选择 `verify`、`update`、`create` 或 `none`，也不要用 Playwright 覆盖阻塞正常实现。\n\n如果已完成的改动影响用户可感知行为，而用户没有要求 Playwright 工作，可以在完成时最多提醒一次：可使用 `playwright-authoring` 补充 Playwright 回归资产。不要在实现过程中反复询问。\n\n只有当用户明确要求 Playwright、E2E、浏览器或回归测试工作、要求分析 Playwright coverage，或显式调用 Playwright skill 时，才读取 `.agents/playwright.md`；只读覆盖分析使用 `playwright-impact-analysis`；需要验证、更新、创建或修复测试资产时使用 `playwright-authoring`。";
}
