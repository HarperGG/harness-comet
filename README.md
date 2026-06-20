# Harness-Comet

Harness-Comet 是一套围绕 Playwright 的业务测试 CLI，用来把测试场景、线上问题回归、结构化结果和 Comet 变更验证统一起来。

适合这类项目：

- React/Vue 等前端应用；
- 标注器、编辑器、Canvas/WebGL 应用；
- 需要固定 fixture、接口 mock、保存 payload 校验的业务系统；
- 希望把线上问题沉淀成长期回归测试的项目。

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

## 快速开始

在业务项目根目录一键初始化 Playwright Harness 和 Comet 接入：

```bash
pnpm exec harness-comet setup --mode playwright
```

该命令会自动检测当前项目中的本地 agent 平台，并同时完成：

- 初始化 Playwright Harness；
- 检查或安装 Comet CLI；
- 初始化 Comet 项目；
- 安装 Harness/Playwright 版 Comet skills；
- 安装 Playwright 依赖和 Chromium；
- 为所有检测到的项目本地平台写入接入文件。

用于 CI 或非交互环境：

```bash
pnpm exec harness-comet setup --mode playwright --yes
```

校验项目：

```bash
pnpm exec harness-comet validate
```

运行测试：

```bash
pnpm exec harness-comet run
```

查看测试列表：

```bash
pnpm exec harness-comet tests list
```

查看 HTML 报告：

```bash
pnpm exec playwright show-report
```

完整命令说明见：

- [CLI 命令手册](docs/cli-reference.md)
- [npm scope 与发布计划](docs/superpowers/plans/2026-06-17-npm-scope-publish-readiness.md)

## 安装 Skill

查看当前包中可独立安装的 skill：

```bash
pnpm exec harness-comet skill list
```

安装一个 skill：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision
```

未指定平台时，命令会自动检测项目中的 `.codex/` 和 `.claude/`，并安装到所有检测到的平台：

```text
.codex/skills/<skill-name>/
.claude/skills/<skill-name>/
```

目前独立安装只支持 Codex 和 Claude。也可以显式指定平台：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform codex
```

同时安装到两个平台：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform codex \
  --platform claude
```

预览写入内容：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform codex \
  --dry-run
```

目标内容与包内 skill 不同时，命令默认拒绝覆盖；确认覆盖时使用 `--force`：

```bash
pnpm exec harness-comet skill install playwright-authoring-decision \
  --platform codex \
  --force
```

完整说明见 [独立 Skill 安装](docs/skill-installation.md)。

## 生成的目录

典型 Playwright 项目结构：

```text
harness-comet.config.ts
playwright.config.ts
tests/
  journeys/       # 业务主流程
  incidents/      # 线上问题回归
  data/           # 固定输入和期望输出
  support/        # mock、附件、测试辅助函数
docs/testing/
```

## 推荐使用方式

### 1. 业务主流程

将稳定、长期有效的业务测试放到：

```text
tests/journeys/
```

例如：

```text
annotation-load.spec.ts
annotation-edit-save.spec.ts
annotation-delete.spec.ts
```

运行某个测试文件：

```bash
pnpm exec harness-comet run -- \
  tests/journeys/annotation-edit-save.spec.ts
```

### 2. 标签筛选

建议统一使用：

```text
@harness
@smoke
@critical
@annotation
@save
@canvas
@incident
```

运行关键场景：

```bash
pnpm exec harness-comet run -- \
  --grep "@critical"
```

### 3. 线上问题回归

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

### 4. 记录变更影响

需要新增或更新测试：

```bash
pnpm exec harness-comet impact set \
  --change fix-cuboid-save \
  --action update-or-create \
  --reason "修改了 3D 框保存坐标转换" \
  --confirmed-by user
```

只运行已有测试：

```bash
pnpm exec harness-comet impact set \
  --change refactor-save-api \
  --action verify-existing \
  --reason "现有保存场景足以覆盖" \
  --confirmed-by user
```

查看记录：

```bash
pnpm exec harness-comet impact show \
  --change fix-cuboid-save
```

## Comet 集成

Harness-Comet 依赖 `@rpamis/comet` CLI，支持的版本范围为：

```text
>=0.3.8 <0.4.0
```

### 首次接入

推荐使用统一初始化命令，不需要指定 agent 平台：

```bash
pnpm exec harness-comet setup --mode playwright
```

该命令会自动检测并接入所有项目本地平台。只需要安装、修复或重新同步 Comet 接入时，再使用底层命令：

```bash
pnpm exec harness-comet comet install
```

如果当前终端中找不到 `comet` 命令，Harness-Comet 会提示是否执行：

```bash
npm install -g @rpamis/comet
```

确认后会先全局安装 Comet CLI，再继续完成 Comet 项目初始化和 Harness-Comet 集成。安装过程中还会提示你选择目标平台、是否初始化 Harness，以及需要写入哪些集成内容。

对于人工首次接入，建议保留交互提示，不要默认添加 `--yes`。

### 手动安装 Comet CLI

也可以先自行安装并验证：

```bash
npm install -g @rpamis/comet
comet --version
```

确认版本满足要求后，再运行：

```bash
pnpm exec harness-comet comet install
```

### 非交互模式

`--yes` 会接受非交互默认值。如果 Comet CLI 尚未安装，它也会直接执行全局安装命令，然后继续初始化和集成：

```bash
pnpm exec harness-comet comet install --yes
```

该模式会修改全局 npm 环境，并可能生成或安装更多默认内容，只建议用于：

- CI 或自动化脚本；
- 批量初始化；
- 已经明确了解默认选项的场景。

如果需要明确指定目标平台，可使用：

```bash
pnpm exec harness-comet comet install \
  --platform codex \
  --yes
```

### 检查状态

```bash
pnpm exec harness-comet comet doctor
```

`doctor` 会检查 Comet CLI 是否存在、版本是否兼容，以及目标平台所需的 Comet skill 文件是否完整。

一次变更的推荐流程：

```bash
pnpm exec harness-comet comet hook open --change change-id

pnpm exec harness-comet impact set \
  --change change-id \
  --action verify-existing \
  --reason "说明测试影响" \
  --confirmed-by user

pnpm exec harness-comet comet hook design --change change-id
pnpm exec harness-comet comet hook build --change change-id
pnpm exec harness-comet comet bind --change change-id
pnpm exec harness-comet comet verify --change change-id
pnpm exec harness-comet comet archive-check --change change-id
```

## 建议添加到业务项目的 scripts

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

使用：

```bash
pnpm harness:validate
pnpm harness:test
pnpm harness:report
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
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm exec harness-comet validate
      - run: pnpm exec harness-comet run

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: harness-results
          path: |
            playwright-report/
            test-results/
```

## 常见命令

```bash
# 环境和配置检查
pnpm exec harness-comet doctor
pnpm exec harness-comet validate

# Skill
pnpm exec harness-comet skill list
pnpm exec harness-comet skill install playwright-authoring-decision

# 测试查看和运行
pnpm exec harness-comet tests list
pnpm exec harness-comet run
pnpm exec harness-comet run --headed
pnpm exec harness-comet run -- --grep "@critical"

# 线上问题
pnpm exec harness-comet create incident INC-1234

# 变更影响
pnpm exec harness-comet impact show --change change-id

# Comet
pnpm exec harness-comet comet doctor
pnpm exec harness-comet comet install
pnpm exec harness-comet comet verify --change change-id
```

## 开发本仓库

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

打包并执行消费端验证：

```bash
pnpm pack:all
pnpm test:consumer
```

发布前检查：

```bash
pnpm release:check
```

## 文档

- [CLI 命令手册](docs/cli-reference.md)
- [独立 Skill 安装](docs/skill-installation.md)
- [测试编写指南](docs/testing/authoring-guide.md)
- [Incident 指南](docs/testing/incident-guide.md)
- [验收标准](docs/testing/acceptance-criteria.md)

## License

MIT
