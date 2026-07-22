export type GuidanceLanguage = "en" | "zh";

export function rulesTemplate(language: GuidanceLanguage): string {
  if (language === "zh") {
    return `# 项目规则

本文件记录用户明确提出并确认的项目级长期规则。

## 红线

当前暂无已确认红线。

## 工程准则

### Playwright 测试

涉及用户可感知行为、新功能、Bug 修复、业务流程变更或可能影响现有行为的重构时，必须读取并遵循 \`.agents/playwright.md\`。

Playwright 测试生成、资产放置和验证的专项规则以 \`.agents/playwright.md\` 为准。
`;
  }
  return `# Project Rules

This file records long-lived project rules explicitly stated and confirmed by the user.

## Red Lines

No confirmed red lines yet.

## Engineering Guidelines

### Playwright testing

When work changes user-visible behavior, implements a feature, fixes a bug, changes a business workflow, or may affect existing behavior, read and follow \`.agents/playwright.md\`.

The Playwright-specific rules for test generation, asset placement, and verification are defined in \`.agents/playwright.md\`.
`;
}

export function structureTemplate(language: GuidanceLanguage): string {
  if (language === "zh") {
    return `# 项目结构

本文件描述项目当前的逻辑结构、主要目录和模块职责。

## 项目概览

待后续归档流程逐步补充。

## 主要目录和模块

- \`.agents/rules.md\`：项目级长期规则和 agent 守门约束。
- \`.agents/structure.md\`：项目结构和模块职责。
- \`.agents/playwright.md\`：Playwright 测试触发条件、测试资产模型、生成规则和原生验证要求。
- \`.agents/scripts/validate-playwright-assets.mjs\`：兼容保留的 Playwright 测试资产放置校验脚本；日常验证以 \`.agents/playwright.md\` 中的原生 Playwright 命令为准。
`;
  }
  return `# Project Structure

This file describes the current logical structure, important directories, and module responsibilities.

## Overview

To be refined by future archive workflows.

## Important Directories and Modules

- \`.agents/rules.md\`: long-lived project rules and agent guardrails.
- \`.agents/structure.md\`: project structure and module responsibilities.
- \`.agents/playwright.md\`: Playwright trigger conditions, test asset model, generation rules, and native verification requirements.
- \`.agents/scripts/validate-playwright-assets.mjs\`: retained compatibility validator for Playwright asset placement; routine verification follows the native Playwright commands in \`.agents/playwright.md\`.
`;
}

export function playwrightPolicyTemplate(language: GuidanceLanguage): string {
  if (language === "zh") {
    return `# Playwright 测试规则

## 规则优先级

本文件是项目 Playwright 测试生成、资产放置和验证的专项规则。涉及 Playwright 测试时，本文件优先于 \`.agents/rules.md\` 中较旧或较通用的 Playwright 描述。

## 默认测试义务

Playwright 测试是功能实现和 Bug 修复的默认交付内容。

当用户要求实现功能、修改行为或修复 Bug 时，视为已经授权创建、更新或验证必要的 Playwright 测试，不需要再次询问用户是否补测试。不得因为用户没有明确提到测试而跳过测试。

## 触发条件

以下任务必须执行 Playwright 测试流程：

- 新增用户可感知功能；
- 修改现有页面、交互或业务流程；
- 修复 Bug 或生产问题；
- 修改数据保存、加载、转换或提交逻辑；
- 修改前端与 API 的交互行为；
- 修改状态、权限、路由、导航或 feature flag；
- 重构可能影响现有行为的代码；
- 创建、修改、移动或修复 Playwright 测试资产。

## 强制工作流

命中触发条件后，必须按顺序执行：

1. 检查相关生产代码和现有 Playwright 测试资产。
2. 明确选择 \`verify\`、\`update\`、\`create\` 或 \`none\`。
3. 确定需要创建或修改的测试资产。
4. 实现业务代码和测试资产。
5. 使用原生 Playwright 命令确认测试被发现。
6. 执行所有创建、修改或选择验证的目标测试。
7. 测试通过后才允许报告完成。

不得先完成业务实现，然后在最终回复中省略测试判断。

## 测试动作

### verify

现有测试已经直接覆盖本次变更行为。必须读取测试内容、说明该测试如何覆盖本次行为并执行对应测试。仅根据文件名、测试名称或关键词相似，不能认定已有覆盖。

### update

现有测试覆盖相关流程，但缺少本次新增行为、步骤、输入、分支或断言。必须更新现有测试或相关测试资产。

### create

没有能够直接证明本次行为的现有测试。必须创建新的 Playwright 测试资产。

### none

只有以下情况允许选择 \`none\`：

- 纯文档修改；
- 纯注释修改；
- 不改变运行行为的格式化；
- 不改变行为的机械性重命名；
- 用户明确要求本次跳过测试。

以下理由不能用于选择 \`none\`：修改很小、功能简单、用户没有要求测试、可能已有测试、测试比较难写、测试运行耗时或业务代码已经能够工作。

## 编写前检查

存在时必须读取：

- \`package.json\`；
- \`playwright.config.*\`；
- 配置的 \`testDir\` 和 \`testMatch\`；
- 相关应用路由和执行入口；
- 相关组件、store、API、serializer 和 feature flag；
- 相关 \`*.spec.*\`；
- fixture 和 Playwright test extension；
- Page Object；
- selector、factory、helper 和测试数据。

必须按业务行为、真实路由、生产源码、API、fixture 和依赖关系查找现有覆盖，不能只按文件名搜索。

## 测试资产模型

按照测试资产的长期用途放置：

\`\`\`text
<testDir>/
  journeys/     长期核心业务链路
  incidents/    Bug、线上问题和事故回归
  data/         固定输入、期望输出和确定性 JSON
  support/      fixture、mock、selector、assertion、factory 和 helper
\`\`\`

规则：

- 长期业务流程 spec 放在 \`journeys/\`；
- Bug 和生产问题回归 spec 放在 \`incidents/\`；
- 固定 case data 和预期结果放在 \`data/\`；
- 可复用代码放在 \`support/\`；
- spec 不得直接放在测试目录根级；
- helper code 不得放在 \`data/\`；
- 固定 case data 不得放在 \`support/\`；
- 一个需求只创建实际需要的资产，不要求同时创建四类资产。

## 测试生成要求

生成或修改测试时必须：

- 测试项目的真实应用入口；
- 测试用户可感知的业务结果；
- 优先复用已有 fixture、Page Object、helper、factory、selector 和测试数据；
- 使用 Playwright locator、自动等待和 web-first assertion；
- 为每个验收行为建立直接断言；
- 使用确定性测试数据并控制外部依赖；
- 在需要时保存 screenshot、payload、attachment 或其他诊断证据。

不得：

- 用生成的 HTML 或测试专用页面替代真实产品；
- mock 被测试的业务功能本身；
- 只断言元素存在而不证明业务结果；
- 使用没有明确理由的 \`waitForTimeout\`；
- 删除、弱化或扩大断言来使测试通过；
- 修改测试期望来掩盖产品缺陷；
- 创建与当前任务无关的测试；
- 创建计划之外的重复 fixture、Page Object 或 helper。

## Bug 修复

修复 Bug 时必须优先：

1. 查找已有相关测试。
2. 创建或更新能够复现问题的测试。
3. 环境允许时，在修改生产代码前确认测试能够暴露问题。
4. 修复生产代码。
5. 重新运行目标测试。
6. 永久保留回归测试。

Bug 专属回归默认放在 \`incidents/\`。如果该 Bug 对应长期核心业务流程，也可以更新已有 \`journeys/\` 测试，但必须确保回归行为有直接断言。

## 原生 Playwright 验证

完成前必须运行：

\`\`\`bash
pnpm exec playwright test --list
pnpm exec playwright test <target-test-file>
\`\`\`

如果项目使用 npm、yarn 或其他包管理器，使用项目现有包管理器执行等价命令。

新增测试时，必须确认目标测试出现在 \`--list\` 输出中。修改共享 fixture、Page Object、selector、factory 或 support helper 时，必须运行所有直接受影响的 spec。

不得使用构建、类型检查、lint 或单元测试替代目标 Playwright 测试。这些命令可以补充执行，但不能代替 Playwright 验证。

## 失败处理

- 测试实现错误：修复测试资产并重新执行；
- 计划遗漏：补充测试计划后再增加资产；
- 产品缺陷：报告产品缺陷，不得弱化测试；
- 环境阻塞：报告具体阻塞和已尝试命令；
- 目标测试失败：不得报告任务成功。

## 完成报告

最终回复必须说明：

- 测试动作：\`verify\`、\`update\`、\`create\` 或 \`none\`；
- 创建、更新或验证的测试文件；
- 测试覆盖的用户行为；
- 复用的 fixture、Page Object、helper、selector 或数据；
- 执行的 Playwright 命令和结果；
- 剩余阻塞或产品问题。

没有创建或更新测试时，必须明确说明采用 \`verify\` 或 \`none\` 的依据。
`;
  }
  return `# Playwright Testing Policy

## Rule precedence

This file is the project-specific source of truth for Playwright test generation, asset placement, and verification. For Playwright work, it takes precedence over older or more general Playwright wording in \`.agents/rules.md\`.

## Default testing obligation

Playwright coverage is part of the default delivery for feature implementation and bug fixes.

A request to implement a feature, change behavior, or fix a bug already authorizes the agent to create, update, or verify the required Playwright tests. Do not ask for separate permission and do not skip tests because the user did not mention them.

## Trigger conditions

Run the Playwright workflow for:

- new user-visible functionality;
- changes to pages, interactions, or business workflows;
- bug or production issue fixes;
- changes to data loading, saving, transformation, or submission;
- changes to frontend/API behavior;
- changes to state, permissions, routing, navigation, or feature flags;
- refactors that may affect existing behavior;
- creation, modification, movement, or repair of Playwright assets.

## Mandatory workflow

When triggered, perform these steps in order:

1. Inspect the relevant production code and existing Playwright assets.
2. Select exactly one action: \`verify\`, \`update\`, \`create\`, or \`none\`.
3. Determine the test assets that must be created or changed.
4. Implement the product code and test assets.
5. Use native Playwright commands to confirm the tests are discovered.
6. Execute every created, updated, or selected verification target.
7. Report completion only after the required tests pass.

Do not finish the product implementation and omit the test decision from the final response.

## Test actions

### verify

Use when an existing test directly covers the changed behavior. Read the test, explain the relationship, and execute it. Filename, test title, or keyword similarity alone is not proof of coverage.

### update

Use when an existing test covers the related workflow but lacks the new behavior, step, input, branch, or assertion. Update the test or related assets.

### create

Use when no existing test directly proves the behavior. Create the required Playwright assets.

### none

Use \`none\` only for documentation-only changes, comment-only changes, formatting that cannot change runtime behavior, mechanical renames that preserve behavior, or when the user explicitly asks to skip tests.

Do not use small scope, simple implementation, no explicit test request, possible existing coverage, test difficulty, test runtime, or working product code as reasons for \`none\`.

## Required inspection

Read when present:

- \`package.json\`;
- \`playwright.config.*\`;
- configured \`testDir\` and \`testMatch\`;
- relevant application routes and execution entries;
- relevant components, stores, APIs, serializers, and feature flags;
- relevant \`*.spec.*\` files;
- fixtures and Playwright test extensions;
- Page Objects;
- selectors, factories, helpers, and test data.

Search by business behavior, real route, production source, API, fixture, and dependency relationship. Do not search by filename alone.

## Test asset model

Place assets according to their long-term purpose:

\`\`\`text
<testDir>/
  journeys/     Long-lived core business journeys
  incidents/    Bug, production issue, and incident regressions
  data/         Fixed input, expected output, and deterministic JSON
  support/      Fixtures, mocks, selectors, assertions, factories, and helpers
\`\`\`

Rules:

- long-lived business specs go in \`journeys/\`;
- bug and production regressions go in \`incidents/\`;
- fixed case data and expected results go in \`data/\`;
- reusable code goes in \`support/\`;
- specs do not go directly under the test directory root;
- helper code does not go in \`data/\`;
- fixed case data does not go in \`support/\`;
- create only the asset types required by the task.

## Test generation requirements

Generated or updated tests must:

- exercise the real application entry;
- prove user-visible business outcomes;
- reuse existing fixtures, Page Objects, helpers, factories, selectors, and data when appropriate;
- use Playwright locators, auto-waiting, and web-first assertions;
- map each acceptance behavior to direct assertions;
- use deterministic data and controlled external dependencies;
- attach screenshots, payloads, attachments, or diagnostics when useful.

Do not:

- replace the real product with generated HTML or a test-only page;
- mock the business capability being tested;
- assert only element existence without proving the business result;
- use unexplained \`waitForTimeout\` calls;
- delete, weaken, or broaden assertions to make tests pass;
- change expectations to hide a product defect;
- create unrelated tests;
- create duplicate fixtures, Page Objects, or helpers outside the plan.

## Bug fixes

For bug fixes:

1. Find related existing coverage.
2. Create or update a test that reproduces the problem.
3. When the environment allows, confirm the test exposes the issue before changing production code.
4. Fix the production code.
5. Re-run the target test.
6. Keep the regression test permanently.

Bug-specific regressions normally belong in \`incidents/\`. Updating an existing \`journeys/\` spec is valid when the bug is part of a long-lived core workflow and the regression behavior receives a direct assertion.

## Native Playwright verification

Before completion, run:

\`\`\`bash
pnpm exec playwright test --list
pnpm exec playwright test <target-test-file>
\`\`\`

Use the project's existing package manager when it is not pnpm.

For new tests, confirm the target appears in the \`--list\` output. When a shared fixture, Page Object, selector, factory, or support helper changes, run every directly affected spec.

Build, type checking, lint, and unit tests may supplement this verification, but they do not replace the target Playwright execution.

## Failure handling

- repair test implementation defects and re-run;
- update the plan before adding a missing asset;
- report product defects without weakening the test;
- report exact environment blockers and attempted commands;
- do not report success when a required target fails.

## Completion report

The final response must state:

- the test action: \`verify\`, \`update\`, \`create\`, or \`none\`;
- created, updated, or verified test files;
- the user behavior covered;
- reused fixtures, Page Objects, helpers, selectors, or data;
- Playwright commands and results;
- remaining blockers or product defects.

When no test is created or updated, state the evidence for \`verify\` or \`none\`.
`;
}

export function playwrightAssetValidatorTemplate(language: GuidanceLanguage): string {
  const successMessage = language === "zh"
    ? "Playwright 测试资产放置校验通过"
    : "Playwright asset placement validation passed";
  return `#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(parseRootArg(process.argv.slice(2)) ?? process.cwd());
const testDir = normalizePath(await resolvePlaywrightTestDir(root));
const testRoot = path.join(root, testDir);
const errors = [];

if (!(await exists(testRoot))) {
  console.log(\`No Playwright test directory found: \${testDir}\`);
  process.exit(0);
}

const files = await walk(testRoot);
for (const absolutePath of files) {
  const relativeToTestDir = normalizePath(path.relative(testRoot, absolutePath));
  if (!relativeToTestDir || shouldIgnore(relativeToTestDir)) continue;

  const topLevel = relativeToTestDir.split("/")[0];
  const inKnownAssetRoot = ["journeys", "incidents", "data", "support"].includes(topLevel);

  if (isPlaywrightSpec(relativeToTestDir)) {
    if (!isUnder(relativeToTestDir, "journeys") && !isUnder(relativeToTestDir, "incidents")) {
      errors.push(
        \`Playwright spec must be under \${testDir}/journeys/ or \${testDir}/incidents/: \${testDir}/\${relativeToTestDir}\`
      );
    }
    continue;
  }

  if (isUnder(relativeToTestDir, "data")) {
    if (!isJsonData(relativeToTestDir)) {
      errors.push(
        \`Fixed test data under \${testDir}/data/ must be JSON: \${testDir}/\${relativeToTestDir}\`
      );
    }
    continue;
  }

  if (isUnder(relativeToTestDir, "support")) {
    if (isJsonData(relativeToTestDir)) {
      errors.push(
        \`Fixed case data belongs under \${testDir}/data/, not \${testDir}/support/: \${testDir}/\${relativeToTestDir}\`
      );
    }
    continue;
  }

  if (!inKnownAssetRoot && isLikelyPlaywrightAsset(relativeToTestDir)) {
    errors.push(
      \`Playwright asset must be placed under \${testDir}/journeys/, \${testDir}/incidents/, \${testDir}/data/, or \${testDir}/support/: \${testDir}/\${relativeToTestDir}\`
    );
  }
}

if (errors.length > 0) {
  console.error("Playwright asset placement validation failed:\\n");
  for (const error of errors) console.error(\`- \${error}\`);
  console.error("\\nUse playwright-authoring, or move each asset to the correct test asset directory.");
  process.exit(1);
}

console.log(${JSON.stringify(successMessage)});

function parseRootArg(args) {
  const index = args.indexOf("--root");
  if (index >= 0) return args[index + 1];
  return undefined;
}

async function resolvePlaywrightTestDir(projectRoot) {
  const harnessConfig = await readOptional(path.join(projectRoot, "harness-comet.config.ts"));
  const harnessTestDir = extractTestDir(harnessConfig);
  if (harnessTestDir) return harnessTestDir;

  const playwrightConfig = await readOptional(path.join(projectRoot, "playwright.config.ts"));
  const playwrightTestDir = extractTestDir(playwrightConfig);
  if (playwrightTestDir) return playwrightTestDir;

  return "tests";
}

function extractTestDir(content) {
  if (!content) return undefined;
  const match = content.match(/testDir\\s*:\\s*["']([^"']+)["']/);
  return match?.[1];
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

async function readOptional(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return undefined;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    return false;
  }
}

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function isUnder(filePath, directory) {
  return filePath === directory || filePath.startsWith(\`\${directory}/\`);
}

function shouldIgnore(filePath) {
  return filePath.startsWith("test-results/") || filePath.includes("/test-results/") || filePath.includes("/node_modules/");
}

function isPlaywrightSpec(filePath) {
  return /(^|\\/)[^/]+\\.(spec|test)\\.[cm]?[jt]sx?$/.test(filePath);
}

function isJsonData(filePath) {
  return /\\.json$/i.test(filePath);
}

function isCodeFile(filePath) {
  return /\\.[cm]?[jt]sx?$/.test(filePath);
}

function isLikelyPlaywrightAsset(filePath) {
  return isCodeFile(filePath) || isJsonData(filePath);
}
`;
}
