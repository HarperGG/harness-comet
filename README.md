# Harness-Comet

Harness-Comet 是一套把业务测试、结构化验证、线上问题回归和 Comet 变更流程连接起来的 CLI。

当前主推 Playwright 模式，同时保留一套可运行、可扩展的 Runtime 场景引擎。

## 适用场景

Playwright 模式适合：

- React、Vue 等 Web 应用；
- 编辑器、标注器、Canvas/WebGL 应用；
- 需要 fixture、接口 mock、保存 payload 和视觉证据的业务系统；
- 希望把线上问题沉淀为长期回归测试的项目。

Runtime 模式适合：

- 非 UI 的 YAML 场景；
- API、CLI、后台服务或领域模型；
- 自定义 adapter、inspector 和 oracle；
- 需要通用结构化执行引擎的项目。

不确定时，优先选择 Playwright 模式。

## 安装

```bash
pnpm add -D @hapergg/harness-comet-cli
```

要求：

```text
Node.js >= 20
```

验证：

```bash
pnpm exec harness-comet --version
pnpm exec harness-comet --help
```

## 快速开始：Playwright 模式

在业务项目根目录运行：

```bash
pnpm exec harness-comet setup --mode playwright
```

该命令会：

1. 初始化 Playwright Harness；
2. 检查或安装兼容版本的 Comet CLI；
3. 进入 Comet 的交互式项目初始化；
4. 根据用户选择安装 Harness-Comet skills；
5. 安装 Playwright 依赖和 Chromium；
6. 创建共享项目知识文件；
7. 为已选择的 Agent 写入原生项目指令入口。

人工首次接入建议保留交互过程，不要默认加 `--yes`。

### 只初始化 Playwright Harness

不需要接入 Comet、Agent skills、`.agents` 项目知识文件或 Agent 原生入口时，使用：

```bash
pnpm exec harness-comet init --mode playwright
```

该命令只生成 Playwright Harness 所需的配置、测试目录、示例测试和测试文档。

常用选项：

```bash
pnpm exec harness-comet init \
  --mode playwright \
  --test-dir tests/harness \
  --skip-install \
  --skip-browsers
```

| 命令 | Playwright Harness | Comet | `.agents` 和 Agent 入口 |
|---|---|---|---|
| `init --mode playwright` | 是 | 否 | 否 |
| `setup --mode playwright` | 是 | 是 | 是 |

初始化后：

```bash
pnpm exec harness-comet validate
pnpm exec harness-comet comet doctor
pnpm exec harness-comet tests list
pnpm exec harness-comet run
```

查看报告：

```bash
pnpm exec playwright show-report
```

完整步骤见 [接入手册](docs/getting-started.md)。

## 两种模式

| 能力 | Playwright | Runtime |
|---|---|---|
| Web UI / E2E | 默认推荐 | 不优先 |
| 原生 Playwright fixtures 和 reporter | 是 | 否 |
| journey / incident 回归 | 是 | 否 |
| YAML 场景 | 否 | 是 |
| 自定义 adapter | 非核心 | 核心扩展点 |
| 结构化 JSON 执行结果 | 是 | 是 |
| Comet Playwright impact / verify / archive gate | 完整 | 不适用 |

### Runtime 是否可用

可以使用。

Runtime 具备完整的初始化、schema 校验、场景发现、fixture、adapter、oracle、执行和 JSON 结果链路，并有 CLI 集成测试覆盖。

初始化：

```bash
pnpm exec harness-comet init \
  --mode runtime \
  --adapter memory \
  --yes
```

运行：

```bash
pnpm exec harness-comet validate
pnpm exec harness-comet scenario list
pnpm exec harness-comet run --scenario example-smoke
```

Runtime 当前属于高级用法，文档和业务约定少于 Playwright 模式。详情见 [Runtime 模式](docs/runtime-mode.md)。

## 支持的 Agent 平台

统一 setup、Comet 接入和独立 Skill 安装均支持：

| Agent | Skills 目录 | 项目指令入口 |
|---|---|---|
| Codex | `.codex/skills/` | `AGENTS.md` |
| Claude Code | `.claude/skills/` | `CLAUDE.md` |
| Cursor | `.cursor/skills/` | `.cursor/rules/harness-comet.mdc` |
| GitHub Copilot | `.github/skills/` | `.github/copilot-instructions.md` |

平台入口只引用统一项目知识：

```text
.agents/rules.md
.agents/structure.md
```

已有入口内容会被保留，Harness-Comet 只维护自己的 managed block。

## 项目知识文件

### `.agents/rules.md`

记录用户明确提出并确认、适用于后续工作的长期项目规则：

- 红线；
- 工程准则；
- 测试要求；
- 协作约定；
- Agent 行为约束。

不会把当前需求、实现细节、临时方案或 Agent 自己推断的最佳实践自动提升为规则。

### `.agents/structure.md`

记录项目当前的逻辑结构、重要目录、模块职责和长期架构关系，不复制完整文件树。

### Archive 阶段

Comet Archive 会在最终 `archive-check` 前：

1. 读取 change 的 proposal、design、tasks、specs、Design Doc、Plan 和验证报告；
2. 检查用户是否明确提出了长期规则；
3. 检查项目结构是否发生长期变化；
4. 与现有知识文件进行语义比较；
5. 展示明确 diff 和依据；
6. 等待用户应用、逐项调整、跳过或暂不归档；
7. 仅在用户确认后写入。

## Playwright 项目结构

```text
harness-comet.config.ts
playwright.config.ts
.agents/
  rules.md
  structure.md
tests/
  journeys/       # 长期业务主流程
  incidents/      # 线上问题回归
  data/           # 固定输入和期望输出
  support/        # mock、附件和测试辅助
docs/testing/
```

## 常用 Playwright 用法

运行指定文件：

```bash
pnpm exec harness-comet run -- \
  tests/journeys/annotation-edit-save.spec.ts
```

按标签：

```bash
pnpm exec harness-comet run -- --grep "@critical"
```

创建 incident：

```bash
pnpm exec harness-comet create incident INC-1234 \
  --title "切换帧后保存坐标错误" \
  --issue-url "https://example.com/issues/INC-1234"
```

推荐流程：

```text
发现问题
→ 固定复现数据
→ 写出失败测试
→ 修复代码
→ 测试变绿
→ 永久保留为回归资产
```

## Comet 集成

Harness-Comet 支持的 Comet CLI 版本：

```text
>=0.3.8 <0.4.0
```

推荐统一初始化：

```bash
pnpm exec harness-comet setup --mode playwright
```

只重新安装或同步 Comet 接入：

```bash
pnpm exec harness-comet comet install
pnpm exec harness-comet comet doctor
pnpm exec harness-comet comet diff
pnpm exec harness-comet comet sync
```

非交互模式：

```bash
pnpm exec harness-comet setup --mode playwright --yes
```

`--yes` 可能安装全局 Comet CLI 并接受默认选项，只建议用于 CI、批量初始化或已明确默认配置的场景。

## 独立 Skill 安装

```bash
pnpm exec harness-comet skill list
pnpm exec harness-comet skill install playwright-authoring-decision
```

支持：

```text
codex
claude
cursor
github-copilot
```

显式安装到 Cursor 或 GitHub Copilot：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform cursor

pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform github-copilot
```

完整说明见 [独立 Skill 安装](docs/skill-installation.md)。

## 推荐 scripts

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

## CI 示例

```yaml
name: Harness Tests

on:
  pull_request:
  push:
    branches: [main]

jobs:
  harness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec harness-comet validate
      - run: pnpm exec harness-comet run
```

## 文档

- [文档索引](docs/README.md)
- [接入手册](docs/getting-started.md)
- [CLI 命令手册](docs/cli-reference.md)
- [Runtime 模式](docs/runtime-mode.md)
- [独立 Skill 安装](docs/skill-installation.md)
