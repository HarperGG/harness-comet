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

在业务项目中初始化 Playwright 模式：

```bash
pnpm exec harness-comet init \
  --mode playwright \
  --test-dir tests \
  --yes
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

检查：

```bash
pnpm exec harness-comet comet doctor
```

推荐使用交互式安装：

```bash
pnpm exec harness-comet comet install
```

安装过程中会提示你选择目标平台、是否初始化 Harness，以及需要写入哪些集成内容。对于人工首次接入，建议保留这些提示，不要默认加 `--yes`。

`--yes` 会直接接受非交互默认值，可能生成或安装更多默认内容，只建议在 CI、自动化脚本，或你已经明确了解默认选择时使用：

```bash
pnpm exec harness-comet comet install --yes
```

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
- [测试编写指南](docs/testing/authoring-guide.md)
- [Incident 指南](docs/testing/incident-guide.md)
- [验收标准](docs/testing/acceptance-criteria.md)

## License

MIT
