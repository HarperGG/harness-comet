# Harness-Comet 接入手册

本文档面向第一次把 Harness-Comet 接入业务项目的开发者。

## 1. 选择模式

Harness-Comet 提供两种项目模式：

| 模式 | 适用场景 | 推荐程度 |
|---|---|---|
| `playwright` | Web UI、编辑器、Canvas/WebGL、端到端业务流程、线上问题回归 | 默认推荐 |
| `runtime` | YAML 场景、fixture、adapter、oracle 驱动的非 UI 或自定义执行流程 | 可用，但属于高级用法 |

大多数前端业务项目应选择 Playwright 模式。

## 2. 安装 CLI

```bash
pnpm add -D @hapergg/harness-comet-cli
```

要求 Node.js 20 或更高版本。

```bash
pnpm exec harness-comet --version
pnpm exec harness-comet --help
```

## 3. 新项目或首次接入

在业务项目根目录运行：

```bash
pnpm exec harness-comet setup --mode playwright
```

该命令会：

1. 初始化 Playwright Harness 文件；
2. 检查或安装兼容版本的 Comet CLI；
3. 进入 Comet 的交互式项目初始化；
4. 根据用户在 Comet 中选择的平台安装 Harness-Comet skills；
5. 安装 Playwright 依赖和 Chromium；
6. 创建共享项目知识文件；
7. 为检测到的 Agent 创建或更新原生项目指令入口。

人工首次接入建议保留交互过程，不要默认添加 `--yes`。

## 4. 支持的 Agent 平台

统一 setup、Comet 接入和独立 `skill install` 均支持：

| Agent | Comet skills | 项目指令入口 |
|---|---|---|
| Codex | `.codex/skills/` | `AGENTS.md` |
| Claude Code | `.claude/skills/` | `CLAUDE.md` |
| Cursor | `.cursor/skills/` | `.cursor/rules/harness-comet.mdc` |
| GitHub Copilot | `.github/skills/` | `.github/copilot-instructions.md` |

Harness-Comet 不会复制整份规则到四个平台。平台入口只引用统一知识文件：

```text
.agents/rules.md
.agents/structure.md
```

已有入口文件会保留用户内容，只创建或替换 Harness-Comet managed block。

独立 Skill 安装未指定平台时，会检测 `.codex/`、`.claude/`、`.cursor/` 和 `.github/`，并安装到所有检测到的平台。

## 5. 已有 Playwright 项目

建议把 Harness 测试放到独立目录：

```bash
pnpm exec harness-comet setup \
  --mode playwright \
  --test-dir tests/harness \
  --skip-install \
  --skip-browsers
```

然后手动合并现有 `playwright.config.ts`，不要直接覆盖已有业务配置。

重点检查：

- `testDir` 是否指向正确目录；
- Web Server 配置是否沿用项目现有启动命令；
- reporter 是否保留 Harness reporter；
- 已有 fixtures、Page Objects 和测试工具是否应该复用；
- CI 中是否安装 Chromium。

## 6. 非交互和 CI 接入

只有在明确知道默认选择时使用：

```bash
pnpm exec harness-comet setup --mode playwright --yes
```

如需明确平台，可使用底层命令：

```bash
pnpm exec harness-comet comet install \
  --platform codex \
  --yes
```

`--yes` 可能修改全局 npm 环境、安装 Comet CLI，并采用默认初始化选项，因此不建议用于人工首次接入。

## 7. 初始化后验证

```bash
pnpm exec harness-comet validate
pnpm exec harness-comet comet doctor
pnpm exec harness-comet tests list
pnpm exec harness-comet run
```

常见生成目录：

```text
harness-comet.config.ts
playwright.config.ts
.agents/
  rules.md
  structure.md
tests/
  journeys/
  incidents/
  data/
  support/
docs/testing/
```

## 8. 项目知识和 Archive

`.agents/rules.md` 只记录用户明确提出、适用于后续工作的长期项目规则，包括红线和工程准则。

`.agents/structure.md` 描述项目逻辑结构、主要目录和模块职责，不是完整文件树。

在 Comet Archive 阶段，Agent 会：

1. 读取本次 change 的 proposal、design、tasks、specs、Design Doc、Plan 和验证报告；
2. 检查是否存在用户明确提出的长期规则；
3. 检查项目结构是否发生长期变化；
4. 与现有两个知识文件比较；
5. 向用户展示明确 diff 和依据；
6. 仅在用户确认后写入；
7. 再执行最终 `archive-check` 和归档确认。

用户可以选择应用、逐项调整、跳过知识更新或暂不归档。

## 9. 推荐项目脚本

```json
{
  "scripts": {
    "harness:validate": "harness-comet validate",
    "harness:list": "harness-comet tests list",
    "harness:test": "harness-comet run",
    "harness:test:headed": "harness-comet run --headed",
    "harness:doctor": "harness-comet doctor",
    "harness:report": "playwright show-report"
  }
}
```

## 10. 下一步

- [CLI 命令手册](./cli-reference.md)
- [Runtime 模式](./runtime-mode.md)
- [独立 Skill 安装](./skill-installation.md)
