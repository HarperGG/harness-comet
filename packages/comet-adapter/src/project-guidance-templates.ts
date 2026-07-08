export type GuidanceLanguage = "en" | "zh";

export function rulesTemplate(language: GuidanceLanguage): string {
  if (language === "zh") {
    return `# 项目规则

本文件记录用户明确提出并确认的项目级长期规则。

## 红线

当前暂无已确认红线。

## 工程准则

### Playwright 测试资产规则

不要在日常功能开发中随意创建或移动 Playwright 测试资产。

当需要生成 Playwright 覆盖时，优先使用 \`playwright-authoring\` 工作流。

如果必须直接创建、更新、移动或删除 Playwright 测试资产，必须遵守项目测试资产模型：

- 长期核心业务链路 spec 放在 \`tests/journeys/\`。
- 线上问题和事故回归 spec 放在 \`tests/incidents/\`。
- 固定输入、期望输出、contract fixture、确定性 JSON 数据放在 \`tests/data/\`。
- mock、request capture、attachment、canvas、assertion、selector、factory 和可复用 helper 放在 \`tests/support/\`。

不要把 Playwright spec 直接放在 \`tests/\` 根目录。
不要把可复用 helper code 放在 \`tests/data/\`。
不要把固定 case data 放在 \`tests/support/\`。

一个需求不需要同时创建四类资产。只创建需要的资产，但每个资产必须放到正确位置。

如果创建、更新、移动或删除了 Playwright 测试资产，必须运行：

\`\`\`bash
node .agents/scripts/validate-playwright-assets.mjs
\`\`\`

只有该命令通过后，Playwright 测试资产变更才算完成。该命令只验证资产放置位置，不证明测试业务覆盖质量。
`;
  }
  return `# Project Rules

This file records long-lived project rules explicitly stated and confirmed by the user.

## Red Lines

No confirmed red lines yet.

## Engineering Guidelines

### Playwright test asset rules

Do not create or move Playwright test assets casually during normal feature work.

When Playwright coverage is required, prefer using the \`playwright-authoring\` workflow.

If you must create, update, move, or delete Playwright test assets directly, follow the project test asset model:

- Long-lived business journey specs go under \`tests/journeys/\`.
- Production incident regressions go under \`tests/incidents/\`.
- Fixed input, expected output, contract fixtures, and deterministic JSON data go under \`tests/data/\`.
- Mock helpers, request capture helpers, attachment helpers, canvas helpers, custom assertions, selectors, factories, and reusable utilities go under \`tests/support/\`.

Do not place Playwright specs directly under \`tests/\`.
Do not place reusable helper code in \`tests/data/\`.
Do not place fixed case data in \`tests/support/\`.

A requirement does not need all four asset types. Create only the assets needed, but place each asset in the correct location.

If you create, update, move, or delete Playwright test assets, run:

\`\`\`bash
node .agents/scripts/validate-playwright-assets.mjs
\`\`\`

Only consider the Playwright asset changes complete when this command passes. This command validates asset placement only; it does not prove business coverage quality.
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
- \`.agents/scripts/validate-playwright-assets.mjs\`：Playwright 测试资产放置校验脚本，供 agent 在创建或修改 Playwright 测试资产后执行。
`;
  }
  return `# Project Structure

This file describes the current logical structure, important directories, and module responsibilities.

## Overview

To be refined by future archive workflows.

## Important Directories and Modules

- \`.agents/rules.md\`: long-lived project rules and agent guardrails.
- \`.agents/structure.md\`: project structure and module responsibilities.
- \`.agents/scripts/validate-playwright-assets.mjs\`: Playwright test asset placement validator for agents to run after creating or modifying Playwright test assets.
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
