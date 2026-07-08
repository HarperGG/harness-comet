# Harness-Comet

Harness-Comet 是一套把业务测试、结构化验证、线上问题回归、Agent 项目知识和 Comet 变更流程连接起来的 CLI。

当前主推 Playwright 模式，同时保留一套可运行、可扩展的 Runtime 场景引擎。Playwright 模式现在还包含项目知识文件、Playwright 测试资产放置校验，以及可独立调用的 Playwright authoring skill 工作流。

## 适用场景

Playwright 模式适合：

- React、Vue 等 Web 应用；
- 编辑器、标注器、Canvas/WebGL 应用；
- 需要 fixture、接口 mock、保存 payload 和视觉证据的业务系统；
- 希望把线上问题沉淀为长期回归测试的项目；
- 希望让 Agent 按统一的项目知识、测试资产模型和验证命令编写 Playwright 覆盖的项目。

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

运行 `setup` 或 `comet install` 前，建议先全局安装 Comet CLI：

<code>npm install &#45;g @rpamis/comet</code>

如果未检测到 Comet CLI，交互式命令会提示是否立即运行上面的全局安装命令；使用 `--yes` 时会接受默认行为。只初始化 Playwright Harness 或 Runtime Harness 时，不需要 Comet CLI。

要求：

```text
Node.js >= 20
Comet CLI >=0.3.8 <0.4.0
```

验证：

```bash
comet --version
pnpm exec harness-comet --version
pnpm exec harness-comet --help
```

## 快速开始：Playwright 模式

在业务项目根目录运行：

<code>npm install &#45;g @rpamis/comet</code>

```bash
pnpm exec harness-comet setup --mode playwright
```

如果 Comet 已经全局安装，可以跳过第一条命令。

该命令会：

1. 初始化 Playwright Harness；
2. 检查兼容版本的 Comet CLI，必要时在交互中引导安装；
3. 进入 Comet 的交互式项目初始化；
4. 根据用户选择安装 Harness-Comet skills；
5. 安装 Playwright 依赖和 Chromium；
6. 创建 `.agents/rules.md`、`.agents/structure.md` 和 `.agents/scripts/validate-playwright-assets.mjs`；
7. 为已选择的 Agent 写入原生项目指令入口；
8. 在 Agent 入口中提示修改 Playwright 测试资产后运行 asset validator。

人工首次接入建议保留交互过程，不要默认加 `--yes`。`--yes` 会接受 Harness-Comet、Comet 初始化和缺失 Comet CLI 安装提示的默认行为，只建议用于 CI、批量初始化或已明确默认配置的场景。

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
| `project-guidance init` | 否 | 否 | 是 |

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
| Agent 项目知识文件 | 是 | 可独立初始化 |
| Playwright asset validator | 是 | 不适用 |
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

### 项目知识入口

`setup`、`comet install` 和 `project-guidance init` 会为下列 Agent 维护原生项目指令入口：

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

### 独立 Skill 安装平台

`skill install` 会从项目中已存在的平台目录自动检测目标，也可以用 `--platform <id>` 显式指定。除上面的四个平台外，当前 registry 还包含 Amazon Q Developer、Antigravity、Auggie、Bob Shell、Cline、CodeBuddy、Continue、CoStrict、Crush、Factory Droid、ForgeCode、Gemini CLI、iFlow、Junie、Kilo Code、Kimi Code、Kiro、Lingma、OpenCode、Pi、Qoder、Qwen Code、RooCode、Trae、Windsurf 等平台。

## 项目知识文件

可以通过完整 `setup` 生成，也可以单独运行：

```bash
pnpm exec harness-comet project-guidance init
```

只初始化某些 Agent 入口：

```bash
pnpm exec harness-comet project-guidance init --agent codex
pnpm exec harness-comet project-guidance init --agent cursor
```

该命令会创建或补齐：

```text
.agents/
  rules.md
  structure.md
  scripts/
    validate-playwright-assets.mjs
```

### `.agents/rules.md`

记录用户明确提出并确认、适用于后续工作的长期项目规则：

- 红线；
- 工程准则；
- 测试要求；
- 协作约定；
- Agent 行为约束；
- Playwright 测试资产放置规则。

不会把当前需求、实现细节、临时方案或 Agent 自己推断的最佳实践自动提升为规则。

### `.agents/structure.md`

记录项目当前的逻辑结构、重要目录、模块职责和长期架构关系，不复制完整文件树。

### `.agents/scripts/validate-playwright-assets.mjs`

当 Agent 或人工创建、更新、移动、删除 Playwright 测试资产后，运行：

```bash
node .agents/scripts/validate-playwright-assets.mjs
```

该脚本会解析 `harness-comet.config.ts` 或 `playwright.config.ts` 中的测试目录，默认回退到 `tests`，并检查 Playwright 测试资产是否符合放置模型：

```text
<testDir>/journeys/    长期核心业务链路 spec
<testDir>/incidents/   线上问题和事故回归 spec
<testDir>/data/        固定输入、期望输出、contract fixture、确定性 JSON 数据
<testDir>/support/     mock、request capture、attachment、canvas、assertion、selector、factory 和 helper
```

它只验证资产放置位置，不证明业务覆盖质量。

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
  scripts/
    validate-playwright-assets.mjs
tests/
  journeys/       # 长期业务主流程
  incidents/      # 线上问题回归
  data/           # 固定输入和期望输出
  support/        # mock、附件和测试辅助
docs/testing/
  authoring/      # playwright-authoring 会话记录
```

## Playwright authoring 工作流

需要让 Agent 规划、生成或修复 Playwright 测试资产时，优先显式调用 `playwright-authoring`。它是用户入口 skill，会按下面的顺序编排三个阶段 skill：

```text
playwright-planner -> playwright-generator -> playwright-healer
```

| Skill | 作用 | 是否写文件 |
|---|---|---|
| `playwright-impact-analysis` | 只读分析变更会影响哪些已有 Playwright 覆盖、哪里有覆盖缺口 | 否 |
| `playwright-authoring` | 用户入口，编排 plan / generate / heal，并维护会话记录 | 是 |
| `playwright-planner` | 从需求、Bug、验收标准或用户流程生成测试资产计划 | 否 |
| `playwright-generator` | 按已批准或显式计划创建、更新或退役测试资产 | 是 |
| `playwright-healer` | 诊断失败 Playwright 目标并做最小安全修复 | 是 |

`playwright-authoring` 会把工作记录写到：

```text
docs/testing/authoring/<session-id>.md
```

会话记录包含 requirement、plan、generation、healing/verification 和 final asset summary。它是工作元数据，不是测试执行的唯一依据。

Authoring 工作流的核心约束：

- 先解析真实项目边界，再决定是否需要 journey、incident、data、support 资产；
- 不要求一个需求同时创建四类资产，只创建计划中需要的文件；
- 新增或修改的文件必须能追溯到计划；
- tests 必须优先复用现有 fixtures、Page Objects、helpers、selectors 和 data；
- 不允许用生成的 HTML 替代真实产品，除非计划明确是 infrastructure self-test 或 example；
- 修复失败测试时不能通过删除或弱化断言来伪造成功；
- 修改 Playwright 测试资产后必须运行 `node .agents/scripts/validate-playwright-assets.mjs`。

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

首次使用前建议先全局安装 Comet：

<code>npm install &#45;g @rpamis/comet</code>

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

`--yes` 会接受 Harness-Comet 和 Comet 初始化的默认选项；如果 Comet CLI 缺失，也会接受默认安装行为。只建议用于 CI、批量初始化或已明确默认配置的场景。

## 独立 Skill 安装

查看可安装 skill：

```bash
pnpm exec harness-comet skill list
```

安装推荐入口：

```bash
pnpm exec harness-comet skill install playwright-authoring
```

安装只读影响分析：

```bash
pnpm exec harness-comet skill install playwright-impact-analysis
```

安装单个阶段 skill：

```bash
pnpm exec harness-comet skill install playwright-planner
pnpm exec harness-comet skill install playwright-generator
pnpm exec harness-comet skill install playwright-healer
```

显式安装到 Cursor 或 GitHub Copilot：

```bash
pnpm exec harness-comet skill install playwright-authoring \
  --platform cursor

pnpm exec harness-comet skill install playwright-authoring \
  --platform github-copilot
```

预览和覆盖：

```bash
pnpm exec harness-comet skill install playwright-authoring --dry-run
pnpm exec harness-comet skill install playwright-authoring --force
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
    "harness:assets": "node .agents/scripts/validate-playwright-assets.mjs",
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
      - run: npm install --global @rpamis/comet
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec harness-comet validate
      - run: node .agents/scripts/validate-playwright-assets.mjs
      - run: pnpm exec harness-comet run
```

## 仓库开发

本仓库是 pnpm workspace：

```text
packages/
  cli/
  core/
  schema/
  adapter-memory/
  adapter-playwright/
  comet-adapter/
examples/
```

常用开发命令：

```bash
pnpm build
pnpm test
pnpm lint
pnpm release:check
```

发布前检查会执行 clean、install、build、test 和 lint；打包和消费者验证使用：

```bash
pnpm pack:all
pnpm test:consumer
```

## 文档

- [文档索引](docs/README.md)
- [接入手册](docs/getting-started.md)
- [CLI 命令手册](docs/cli-reference.md)
- [Runtime 模式](docs/runtime-mode.md)
- [独立 Skill 安装](docs/skill-installation.md)
