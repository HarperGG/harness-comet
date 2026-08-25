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
  return [
    "## Harness-Comet Project Context",
    "",
    "Before changing code, read:",
    "",
    "- Project red lines and engineering guidelines: `.agents/rules.md`",
    "- Project structure and module responsibilities: `.agents/structure.md`",
    "",
    "Playwright authoring is on demand during normal development. A feature request, bug fix, refactor, or user-visible behavior change does not by itself require Playwright coverage analysis, asset generation, or execution. Do not read `.agents/playwright.md` solely because production code changed, do not automatically select `verify`, `update`, `create`, or `none`, and do not block normal implementation on Playwright coverage.",
    "",
    "### Playwright regression recommendation",
    "",
    "After completing a feature, bug fix, or behavior-changing implementation, you MUST perform one lightweight Playwright regression recommendation check before the final response when the user has not already requested Playwright work.",
    "",
    "This recommendation check is not Playwright coverage analysis. Do not inspect or search existing Playwright tests solely for this check, do not read `.agents/playwright.md`, and do not select `verify`, `update`, `create`, or `none`. Use only the requirement or bug description, production code already inspected during implementation, and the behavior that changed.",
    "",
    "Recommend Playwright regression coverage when the completed change has meaningful browser-observable behavior that is valuable to protect against regression, especially for:",
    "",
    "- a user-visible bug reproducible through browser interaction;",
    "- create, edit, save, submit, delete, upload, or other business actions;",
    "- navigation, routing, authentication, permissions, or feature flags;",
    "- loading, success, error, empty, disabled, or other important UI state transitions;",
    "- frontend/API interaction whose result is visible to the user;",
    "- multi-step or business-critical user workflows;",
    "- behavior that has already regressed once or has meaningful regression risk.",
    "",
    "Do not recommend Playwright coverage for documentation, comments, formatting, non-behavioral refactors, build/tooling-only changes, or changes without meaningful browser-observable behavior.",
    "",
    "If regression coverage is recommended, the final response MUST include exactly one short, non-blocking recommendation that names the concrete behavior worth protecting and offers `playwright-authoring`. Ask whether the user wants that coverage added now. Do not invoke `playwright-authoring` until the user explicitly accepts or requests Playwright work.",
    "",
    "If regression coverage is not recommended, do not mention Playwright in the final response.",
    "",
    "Only when the user explicitly requests Playwright, E2E, browser, or regression-test work, asks for Playwright coverage analysis, or invokes a Playwright skill: read `.agents/playwright.md`; use `playwright-impact-analysis` for read-only coverage analysis; use `playwright-authoring` when assets should be verified, updated, created, or repaired."
  ].join("\n");
}

function chineseBody(): string {
  return [
    "## Harness-Comet 项目上下文",
    "",
    "修改代码前请阅读：",
    "",
    "- 项目红线和工程准则：`.agents/rules.md`",
    "- 项目结构和模块职责：`.agents/structure.md`",
    "",
    "日常研发中的 Playwright authoring 按需启用。功能需求、Bug 修复、重构或用户可感知行为修改本身，不要求自动做 Playwright 覆盖分析、测试资产生成或执行。不要仅因为生产代码发生变化就读取 `.agents/playwright.md`，不要自动选择 `verify`、`update`、`create` 或 `none`，也不要用 Playwright 覆盖阻塞正常实现。",
    "",
    "### Playwright 回归覆盖建议",
    "",
    "完成新功能、Bug 修复或行为变更后，如果用户尚未要求 Playwright 工作，在最终回复前必须做一次轻量级 Playwright 回归覆盖建议判断。",
    "",
    "这个判断不是 Playwright coverage analysis。不得仅为了这个判断去搜索或读取已有 Playwright 测试，不得读取 `.agents/playwright.md`，也不得选择 `verify`、`update`、`create` 或 `none`。只根据本次需求或 Bug 描述、实现过程中已经读取的生产代码以及实际发生变化的行为进行判断。",
    "",
    "当本次改动包含具有明确浏览器可观察结果、并且值得防止未来回归的行为时，应建议补充 Playwright 回归覆盖，尤其包括：",
    "",
    "- 可以通过浏览器交互稳定复现的用户可见 Bug；",
    "- 创建、编辑、保存、提交、删除、上传等业务操作；",
    "- 路由、导航、登录、权限或 feature flag；",
    "- loading、success、error、empty、disabled 等重要 UI 状态转换；",
    "- 前端与 API 交互后产生用户可见结果；",
    "- 多步骤或核心业务流程；",
    "- 已经发生过一次回归，或未来回归风险明显的行为。",
    "",
    "纯文档、注释、格式化、不改变行为的重构、构建或工具链修改，以及没有明确浏览器可观察结果的内部修改，不应建议 Playwright 回归覆盖。",
    "",
    "如果判断本次改动值得补充 Playwright 回归覆盖，最终回复中必须且只能给出一次简短、非阻塞的建议，说明值得保护的具体行为，并提出使用 `playwright-authoring` 补充回归覆盖，询问用户是否现在补充。用户明确同意或主动要求 Playwright 工作之前，不得自动调用 `playwright-authoring`。",
    "",
    "如果判断不需要回归覆盖，则最终回复不要提及 Playwright。",
    "",
    "只有当用户明确要求 Playwright、E2E、浏览器或回归测试工作、要求分析 Playwright coverage，或显式调用 Playwright skill 时，才读取 `.agents/playwright.md`；只读覆盖分析使用 `playwright-impact-analysis`；需要验证、更新、创建或修复测试资产时使用 `playwright-authoring`。"
  ].join("\n");
}
