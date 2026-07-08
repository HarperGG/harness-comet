# 独立 Skill 安装

Harness-Comet 的可安装 skill 统一存放在：

```text
packages/comet-adapter/assets/shared-skills/
```

该目录同时作为源码目录和 npm 发布资产。`skill list` 会扫描其中包含 `SKILL.md` 的目录并按名称排序展示。

## 查看可安装 Skill

```bash
pnpm exec harness-comet skill list
```

## 推荐 Skill

| Skill | 用途 |
|---|---|
| `playwright-impact-analysis` | 只读分析一个需求、Bugfix 或变更对现有 Playwright 覆盖的影响，以及覆盖缺口。 |
| `playwright-authoring` | 用户入口工作流，编排 `playwright-planner`、`playwright-generator` 和 `playwright-healer`。 |
| `playwright-planner` | 从具体需求、Bug、验收标准或用户流程生成 Playwright 测试资产计划，不写文件。 |
| `playwright-generator` | 根据已批准或显式计划创建、更新或退役 Playwright 测试资产。 |
| `playwright-healer` | 诊断失败 Playwright 目标并做最小安全修复，不能削弱业务断言。 |
| `playwright-authoring-decision` | Comet / change 流程中的 Playwright 覆盖决策辅助。 |
| `playwright-authoring-plan` | Comet / change 流程中的 Playwright authoring plan 辅助。 |
| `playwright-authoring-build` | Comet / change 流程中的 Playwright authoring build 辅助。 |
| `playwright-authoring-verify` | Comet / change 流程中的 Playwright authoring verify 辅助。 |
| `playwright-authoring-standalone-adapter` | 独立 authoring 场景的 adapter 辅助。 |

一般情况下，用户直接安装并调用 `playwright-authoring` 即可；阶段 skill 主要供 `playwright-authoring` 内部委派，或在你只需要单个阶段时显式调用。

## 自动检测并安装

```bash
pnpm exec harness-comet skill install playwright-authoring
```

未指定平台时会检测项目中已存在的平台根目录。例如：

```text
.codex/
.claude/
.cursor/
.github/
.gemini/
.qwen/
.windsurf/
```

检测到的平台会写入对应的 skills 目录：

```text
.<platform>/skills/<skill-name>/
```

常见示例：

```text
.codex/skills/<skill-name>/
.claude/skills/<skill-name>/
.cursor/skills/<skill-name>/
.github/skills/<skill-name>/
.gemini/skills/<skill-name>/
.qwen/skills/<skill-name>/
.windsurf/skills/<skill-name>/
```

## 显式指定平台

Cursor：

```bash
pnpm exec harness-comet skill install playwright-authoring \
  --platform cursor
```

GitHub Copilot：

```bash
pnpm exec harness-comet skill install playwright-authoring \
  --platform github-copilot
```

多个平台：

```bash
pnpm exec harness-comet skill install playwright-authoring \
  --platform codex \
  --platform claude \
  --platform cursor \
  --platform github-copilot
```

安装只读影响分析：

```bash
pnpm exec harness-comet skill install playwright-impact-analysis \
  --platform codex
```

安装阶段 skill：

```bash
pnpm exec harness-comet skill install playwright-planner
pnpm exec harness-comet skill install playwright-generator
pnpm exec harness-comet skill install playwright-healer
```

## 支持的平台 ID

`skill install --platform <id>` 使用项目内平台 registry。当前支持：

```text
amazon-q
antigravity
auggie
bob
claude
cline
codebuddy
codex
continue
costrict
crush
cursor
factory
forgecode
gemini
github-copilot
iflow
junie
kilocode
kimicode
kiro
lingma
opencode
pi
qoder
qwen
roocode
trae
windsurf
```

## 安全选项

预览：

```bash
pnpm exec harness-comet skill install playwright-authoring \
  --platform cursor \
  --dry-run
```

覆盖不同内容：

```bash
pnpm exec harness-comet skill install playwright-authoring \
  --platform cursor \
  --force
```

内容一致时操作为 noop。

## 与完整接入的关系

- `setup --mode playwright`：初始化 Playwright Harness、Comet 集成、项目知识文件和 Agent 入口。
- `comet install`：安装或同步 Comet 集成和 managed skill。
- `project-guidance init`：只初始化 `.agents/rules.md`、`.agents/structure.md`、`.agents/scripts/validate-playwright-assets.mjs` 和原生 Agent 入口。
- `skill install`：只安装某个共享 skill，不初始化 Harness、Comet 或项目知识文件。

完整项目接入请参考 [Harness-Comet 接入手册](./getting-started.md)。
