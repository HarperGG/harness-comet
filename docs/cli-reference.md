# Harness-Comet CLI 命令手册

本文档面向使用 `@hapergg/harness-comet-cli` 的项目开发者，重点说明 Playwright 模式下的实际用法。

> Node.js 要求：`>=20`
>
> 安装包：`@hapergg/harness-comet-cli`
>
> 可执行命令：`harness-comet`

## 1. 安装

```bash
pnpm add -D @hapergg/harness-comet-cli
```

验证安装：

```bash
pnpm exec harness-comet --version
pnpm exec harness-comet --help
```

也可以在 `package.json` 中增加常用脚本：

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

---

## 2. 全局参数

全局参数放在子命令之前：

```bash
pnpm exec harness-comet [全局参数] <command>
```

| 参数 | 作用 |
|---|---|
| `--root <path>` | 指定项目根目录；默认是当前目录 |
| `--config <path>` | 指定 `harness-comet.config.ts` 路径 |
| `--json` | 输出机器可读 JSON，适合 CI 或脚本处理 |
| `--quiet` | 隐藏非错误日志 |
| `--verbose` | 输出更完整的错误堆栈 |
| `--no-color` | 禁用终端颜色 |

示例：

```bash
pnpm exec harness-comet \
  --root ../my-react-app \
  --json \
  validate
```

---

## 3. 初始化项目

### Playwright 模式

```bash
pnpm exec harness-comet init \
  --mode playwright \
  --test-dir tests \
  --yes
```

常用选项：

| 参数 | 作用 |
|---|---|
| `--mode playwright` | 初始化标准 Playwright 测试模式 |
| `--test-dir <path>` | 测试目录，默认 `tests` |
| `--skip-install` | 生成文件但不安装依赖 |
| `--skip-browsers` | 不安装 Chromium |
| `--yes` | 接受默认值，适合脚本执行 |
| `--force` | 补充缺失文件 |
| `--overwrite-config` | 覆盖 `harness-comet.config.ts` |

初始化通常会生成：

```text
harness-comet.config.ts
playwright.config.ts
tests/
  journeys/
  incidents/
  data/
  support/
docs/testing/
```

已有 Playwright 项目建议先使用：

```bash
pnpm exec harness-comet init \
  --mode playwright \
  --test-dir tests/harness \
  --skip-install \
  --skip-browsers \
  --yes
```

然后手动合并配置。

---

## 4. 校验项目

```bash
pnpm exec harness-comet validate
```

Playwright 模式下会检查：

- Harness-Comet 配置；
- Playwright 配置；
- 测试目录；
- 测试能否被 Playwright 收集；
- `@harness` 标签覆盖；
- incident 资产结构。

JSON 输出：

```bash
pnpm exec harness-comet --json validate
```

正确的 Playwright 模式输出应包含：

```json
{
  "ok": true,
  "mode": "playwright"
}
```

### 环境诊断

```bash
pnpm exec harness-comet doctor
```

用于检查 Node.js、配置和浏览器环境。

---

## 5. 查看测试

列出所有 Playwright Harness 测试：

```bash
pnpm exec harness-comet tests list
```

按标签过滤：

```bash
pnpm exec harness-comet tests list --tag @harness
pnpm exec harness-comet tests list --tag @critical
```

建议的标签约定：

| 标签 | 用途 |
|---|---|
| `@harness` | 所有 Harness 测试必带 |
| `@smoke` | 快速冒烟 |
| `@critical` | 核心链路 |
| `@annotation` | 标注业务 |
| `@save` | 保存链路 |
| `@canvas` | Canvas/WebGL 场景 |
| `@incident` | 线上问题回归 |

---

## 6. 运行测试

### 运行全部 Harness 测试

```bash
pnpm exec harness-comet run
```

### 有界面运行

```bash
pnpm exec harness-comet run --headed
```

### 运行指定文件

Playwright 参数必须放在 `--` 后面：

```bash
pnpm exec harness-comet run -- \
  tests/journeys/annotation-edit-save.spec.ts
```

### 按标题或标签筛选

```bash
pnpm exec harness-comet run -- \
  --grep "编辑标注并保存"
```

```bash
pnpm exec harness-comet run -- \
  --grep "@critical"
```

### Playwright 调试模式

```bash
PWDEBUG=1 pnpm exec harness-comet run -- \
  tests/journeys/annotation-edit-save.spec.ts
```

### 更新截图基线

```bash
pnpm exec harness-comet run -- \
  --update-snapshots
```

### 查看 HTML 报告

```bash
pnpm exec playwright show-report
```

### 结果目录

默认生成：

```text
test-results/
playwright-report/
test-results/harness-comet/results.json
```

失败时通常还包括截图、视频、trace 和错误上下文。

---

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

1. 固定输入数据；
2. API mock 或稳定测试环境；
3. 用户操作；
4. 页面或业务状态断言；
5. 保存 payload 断言；
6. 必要的 JSON、截图或 trace 证据。

示例：

```ts
import { expect, test } from "@playwright/test";
import expectedPayload from "../data/expected-save.json" with {
  type: "json"
};

test(
  "编辑标注并保存",
  { tag: ["@harness", "@annotation", "@save", "@critical"] },
  async ({ page }, testInfo) => {
    let capturedPayload: unknown;

    await page.route("**/api/annotations", async route => {
      capturedPayload = JSON.parse(route.request().postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true })
      });
    });

    await page.goto("/tasks/task-001");
    await page.getByTestId("annotation-item-box-001").click();
    await page.getByTestId("attribute-label").selectOption("vehicle");
    await page.getByTestId("save-annotation").click();

    await expect(page.getByTestId("save-status")).toHaveText("已保存");
    expect(capturedPayload).toEqual(expectedPayload);

    await testInfo.attach("saved-payload", {
      body: JSON.stringify(capturedPayload, null, 2),
      contentType: "application/json"
    });
  }
);
```

---

## 8. 创建线上问题回归资产

```bash
pnpm exec harness-comet create incident INC-1234 \
  --title "切换帧后保存坐标错误" \
  --issue-url "https://example.com/issues/INC-1234"
```

选项：

| 参数 | 作用 |
|---|---|
| `<id>` | incident ID，例如 `INC-1234` |
| `--title <text>` | 问题标题 |
| `--issue-url <url>` | 外部 issue 地址 |
| `--force` | 在安全范围内覆盖生成文件 |

推荐流程：

```text
发现线上问题
→ 创建 incident
→ 固定复现数据
→ 先写出失败测试
→ 修复产品代码
→ 测试变绿
→ 永久保留为回归资产
```

运行单个 incident：

```bash
pnpm exec harness-comet run -- \
  tests/incidents/INC-1234/reproduce.spec.ts
```

---

## 9. 记录变更影响

Playwright 模式使用 `impact` 命令记录一次变更应如何处理 Harness 测试。

### 需要新增或修改测试

```bash
pnpm exec harness-comet impact set \
  --change fix-cuboid-save \
  --action update-or-create \
  --reason "修改了 3D 框保存坐标转换" \
  --confirmed-by user
```

### 只运行已有测试

```bash
pnpm exec harness-comet impact set \
  --change refactor-save-api \
  --action verify-existing \
  --reason "保存接口内部重构，已有保存场景足以覆盖" \
  --confirmed-by user
```

### 与测试无关

```bash
pnpm exec harness-comet impact set \
  --change update-readme \
  --action none \
  --reason "只修改文档" \
  --confirmed-by user
```

Playwright action：

| Action | 含义 |
|---|---|
| `none` | 不需要 Harness 测试 |
| `verify-existing` | 运行已有测试即可 |
| `update-or-create` | 需要新增或更新测试资产 |

查看记录：

```bash
pnpm exec harness-comet impact show \
  --change fix-cuboid-save
```

`--confirmed-by` 支持：

```text
user
agent
```

---

## 10. Comet 集成

### 检查 Comet 状态

```bash
pnpm exec harness-comet comet doctor
```

### 安装集成

```bash
pnpm exec harness-comet comet install --yes
```

同时初始化 Playwright Harness：

```bash
pnpm exec harness-comet comet install \
  --init-harness \
  --mode playwright \
  --test-dir tests \
  --yes
```

预览安装改动：

```bash
pnpm exec harness-comet comet install \
  --mode playwright \
  --dry-run
```

同步已管理的集成文件：

```bash
pnpm exec harness-comet comet sync
```

查看差异：

```bash
pnpm exec harness-comet comet diff
```

卸载：

```bash
pnpm exec harness-comet comet uninstall
```

### Comet 生命周期

假设 change ID 为 `fix-cuboid-save`。

Open：

```bash
pnpm exec harness-comet comet hook open \
  --change fix-cuboid-save
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
hook open
→ impact set
→ hook design
→ 编写或更新测试
→ hook build
→ bind
→ verify
→ archive-check
```

---

## 11. CI 使用

最小 GitHub Actions 示例：

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

PR 只跑关键场景：

```bash
pnpm exec harness-comet run -- --grep "@smoke|@critical"
```

夜间或主分支运行完整测试：

```bash
pnpm exec harness-comet run
```

---

## 12. 常见问题

### `run` 提示必须使用 `--scenario`、`--tag` 或 `--all`

项目被识别成 Runtime 模式。检查：

```ts
export default {
  schemaVersion: 1,
  mode: "playwright"
};
```

再执行：

```bash
pnpm exec harness-comet --json validate
```

输出应包含：

```json
{
  "mode": "playwright"
}
```

### Reporter 无法解析

检查：

```bash
node --input-type=module -e \
  "console.log(import.meta.resolve('@hapergg/harness-comet-playwright/reporter'))"
```

并确认 `playwright.config.ts` 中使用：

```ts
["@hapergg/harness-comet-playwright/reporter"]
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

### 机器读取结果

```bash
pnpm exec harness-comet --json validate
pnpm exec harness-comet --json tests list
```

---

## 13. 推荐日常工作流

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
