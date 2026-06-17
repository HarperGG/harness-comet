# Harness-Comet CLI 命令手册

本文档面向使用 `@hapergg/harness-comet-cli` 的项目开发者，重点说明 Playwright 模式下的实际用法。

> Node.js：`>=20`
>
> 安装包：`@hapergg/harness-comet-cli`
>
> 可执行命令：`harness-comet`

## 1. 安装

```bash
pnpm add -D @hapergg/harness-comet-cli
```

验证：

```bash
pnpm exec harness-comet --version
pnpm exec harness-comet --help
```

推荐加入业务项目的 `package.json`：

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

## 2. 全局参数

```bash
pnpm exec harness-comet [全局参数] <command>
```

| 参数 | 作用 |
|---|---|
| `--root <path>` | 指定项目根目录 |
| `--config <path>` | 指定配置文件 |
| `--json` | 输出 JSON，适合 CI 和脚本 |
| `--quiet` | 隐藏非错误日志 |
| `--verbose` | 输出完整错误堆栈 |
| `--no-color` | 禁用颜色 |

示例：

```bash
pnpm exec harness-comet \
  --root ../my-react-app \
  --json \
  validate
```

## 3. 初始化 Playwright 项目

```bash
pnpm exec harness-comet init \
  --mode playwright \
  --test-dir tests \
  --yes
```

常用选项：

| 参数 | 作用 |
|---|---|
| `--mode playwright` | 使用标准 Playwright 模式 |
| `--test-dir <path>` | 测试目录，默认 `tests` |
| `--skip-install` | 只生成文件，不安装依赖 |
| `--skip-browsers` | 不安装 Chromium |
| `--yes` | 接受 init 的默认值 |
| `--force` | 补充缺失文件 |
| `--overwrite-config` | 覆盖 Harness 配置 |

已有 Playwright 项目建议：

```bash
pnpm exec harness-comet init \
  --mode playwright \
  --test-dir tests/harness \
  --skip-install \
  --skip-browsers \
  --yes
```

然后手动合并现有 `playwright.config.ts`。

## 4. 校验和诊断

校验项目：

```bash
pnpm exec harness-comet validate
```

JSON 输出：

```bash
pnpm exec harness-comet --json validate
```

Playwright 模式应包含：

```json
{
  "ok": true,
  "mode": "playwright"
}
```

环境诊断：

```bash
pnpm exec harness-comet doctor
```

## 5. 查看和运行测试

查看全部测试：

```bash
pnpm exec harness-comet tests list
```

按标签查看：

```bash
pnpm exec harness-comet tests list --tag @critical
```

运行全部测试：

```bash
pnpm exec harness-comet run
```

有界面运行：

```bash
pnpm exec harness-comet run --headed
```

运行指定文件：

```bash
pnpm exec harness-comet run -- \
  tests/journeys/annotation-edit-save.spec.ts
```

按标题或标签筛选：

```bash
pnpm exec harness-comet run -- \
  --grep "编辑标注并保存"
```

```bash
pnpm exec harness-comet run -- \
  --grep "@critical"
```

调试模式：

```bash
PWDEBUG=1 pnpm exec harness-comet run -- \
  tests/journeys/annotation-edit-save.spec.ts
```

更新截图基线：

```bash
pnpm exec harness-comet run -- \
  --update-snapshots
```

查看报告：

```bash
pnpm exec playwright show-report
```

默认结果：

```text
test-results/
playwright-report/
test-results/harness-comet/results.json
```

## 6. 推荐标签

| 标签 | 用途 |
|---|---|
| `@harness` | 所有 Harness 测试 |
| `@smoke` | 快速冒烟 |
| `@critical` | 核心业务链路 |
| `@annotation` | 标注业务 |
| `@save` | 保存链路 |
| `@canvas` | Canvas/WebGL 场景 |
| `@incident` | 线上问题回归 |

## 7. 编写业务测试

推荐目录：

```text
tests/
  journeys/       # 长期业务主流程
  incidents/      # 线上问题回归
  data/           # 固定输入和期望输出
  support/        # mock、附件和辅助函数
```

一个测试至少应包含：

1. 固定输入；
2. API mock 或稳定测试环境；
3. 用户操作；
4. 页面或业务状态断言；
5. 保存 payload 断言；
6. 必要的 JSON、截图或 trace 证据。

## 8. 创建线上问题回归资产

```bash
pnpm exec harness-comet create incident INC-1234 \
  --title "切换帧后保存坐标错误" \
  --issue-url "https://example.com/issues/INC-1234"
```

推荐流程：

```text
发现问题
→ 创建 incident
→ 固定复现数据
→ 先写失败测试
→ 修复代码
→ 测试变绿
→ 永久保留
```

运行单个 incident：

```bash
pnpm exec harness-comet run -- \
  tests/incidents/INC-1234/reproduce.spec.ts
```

## 9. 记录变更影响

需要新增或修改测试：

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

与测试无关：

```bash
pnpm exec harness-comet impact set \
  --change update-readme \
  --action none \
  --reason "只修改文档" \
  --confirmed-by user
```

查看记录：

```bash
pnpm exec harness-comet impact show \
  --change fix-cuboid-save
```

Playwright action：

| Action | 含义 |
|---|---|
| `none` | 不需要 Harness 测试 |
| `verify-existing` | 运行已有测试 |
| `update-or-create` | 新增或更新测试资产 |

## 10. Comet 集成

### 10.1 检查状态

```bash
pnpm exec harness-comet comet doctor
```

### 10.2 推荐：交互式安装

首次人工接入时，推荐直接运行：

```bash
pnpm exec harness-comet comet install
```

这个命令会保留交互提示，让你逐步确认：

- 安装到哪个已检测平台；
- 是否初始化 Harness；
- 需要写入哪些 Comet 集成文件；
- 是否采用当前检测到的默认配置。

交互式安装更适合业务项目首次接入，可以避免在不了解默认选项时生成不需要的额外内容。

### 10.3 `--yes` 的使用范围

```bash
pnpm exec harness-comet comet install --yes
```

`--yes` 会接受非交互默认值，可能安装或生成更多默认内容。只建议用于：

- CI；
- 自动化脚本；
- 批量初始化；
- 已经明确了解全部默认选项的场景。

不要把 `--yes` 作为人工首次接入的默认命令。

### 10.4 同时初始化 Playwright Harness

人工使用时仍建议保留交互：

```bash
pnpm exec harness-comet comet install \
  --init-harness \
  --mode playwright \
  --test-dir tests
```

自动化场景才增加：

```bash
pnpm exec harness-comet comet install \
  --init-harness \
  --mode playwright \
  --test-dir tests \
  --yes
```

### 10.5 预览、同步和卸载

预览安装计划：

```bash
pnpm exec harness-comet comet install --dry-run
```

查看差异：

```bash
pnpm exec harness-comet comet diff
```

同步受管理文件：

```bash
pnpm exec harness-comet comet sync
```

卸载：

```bash
pnpm exec harness-comet comet uninstall
```

## 11. Comet 生命周期

假设 change ID 为 `fix-cuboid-save`。

Open：

```bash
pnpm exec harness-comet comet hook open \
  --change fix-cuboid-save
```

记录影响：

```bash
pnpm exec harness-comet impact set \
  --change fix-cuboid-save \
  --action update-or-create \
  --reason "修改保存行为" \
  --confirmed-by user
```

Design：

```bash
pnpm exec harness-comet comet hook design \
  --change fix-cuboid-save
```

Build：

```bash
pnpm exec harness-comet comet hook build \
  --change fix-cuboid-save
```

绑定 change：

```bash
pnpm exec harness-comet comet bind \
  --change fix-cuboid-save
```

验证：

```bash
pnpm exec harness-comet comet verify \
  --change fix-cuboid-save
```

归档前检查：

```bash
pnpm exec harness-comet comet archive-check \
  --change fix-cuboid-save
```

推荐顺序：

```text
comet install（首次接入，交互式）
→ hook open
→ impact set
→ hook design
→ 编写或更新测试
→ hook build
→ bind
→ verify
→ archive-check
```

## 12. CI 使用

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

## 13. 常见问题

### `run` 要求 `--scenario`、`--tag` 或 `--all`

项目被识别成 Runtime 模式。检查：

```ts
export default {
  schemaVersion: 1,
  mode: "playwright"
};
```

然后：

```bash
pnpm exec harness-comet --json validate
```

### Reporter 无法解析

```bash
node --input-type=module -e \
  "console.log(import.meta.resolve('@hapergg/harness-comet-playwright/reporter'))"
```

### 浏览器未安装

```bash
pnpm exec playwright install chromium
```

Linux CI：

```bash
pnpm exec playwright install --with-deps chromium
```

### 查看完整错误

```bash
pnpm exec harness-comet --verbose run
```

## 14. 推荐日常工作流

首次接入 Comet：

```bash
pnpm exec harness-comet comet install
```

新增功能：

```bash
pnpm exec harness-comet impact set \
  --change feature-id \
  --action update-or-create \
  --reason "新增业务行为" \
  --confirmed-by user

pnpm exec harness-comet validate
pnpm exec harness-comet run -- tests/journeys/new-flow.spec.ts
```

修复问题：

```bash
pnpm exec harness-comet create incident INC-1234
pnpm exec harness-comet run -- tests/incidents/INC-1234/reproduce.spec.ts
```

提交前：

```bash
pnpm exec harness-comet validate
pnpm exec harness-comet run -- --grep "@smoke|@critical"
```

合并或归档前：

```bash
pnpm exec harness-comet comet verify --change change-id
pnpm exec harness-comet comet archive-check --change change-id
```
