---
name: comet-archive
description: "Comet 阶段 5：归档。用 /comet-archive 调用。完整保留官方中文 Archive 工作流，并集成 Harness/Playwright receipt 新鲜度检查。"
---

# Comet 阶段 5：归档（Archive）

<!--
由 @hapergg/harness-comet 管理。
官方中文上游基线：https://github.com/rpamis/comet/tree/master/assets/skills-zh/comet-archive
此托管副本完整保留官方中文流程，并增加 Harness/Playwright 归档预检。
不要直接修改已安装副本。
-->

## 前置条件

- 验证已通过（阶段 4 完成）
- 分支已处理
- `openspec/changes/<name>/.comet.yaml` 中 `verify_result: pass`

## 步骤

### 0a. 输出语言约束

归档摘要和生命周期闭环说明必须使用触发本次工作流的用户请求语言。

### 0b. 入口状态验证（Entry Check）

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
if [ -z "$COMET_STATE" ] || [ -z "$COMET_ARCHIVE" ]; then
  echo "ERROR: Comet scripts not found. Ensure the comet skill is installed." >&2
  return 1
fi
"$COMET_BASH" "$COMET_STATE" check <name> archive
```

验证通过后继续。

### 1. Harness/Playwright 归档预检

项目为 Playwright 模式，且 change 包含 `Playwright Authoring Decision`、Playwright plan 或 Harness 验证 receipt 时，必须在展示最终归档确认前执行：

```bash
pnpm exec harness-comet comet archive-check --change <change-name>
```

预检必须确认：

- 验证 receipt 存在，且状态为通过或明确 not-applicable
- receipt、results、report 和 fingerprints 对当前 change 状态仍然新鲜
- 已声明目标和目标操作保持一致
- 所需证据路径仍存在
- ignored 与 retired 目标处理一致
- 必需 incident 绑定或未解决 incident 引用有效
- 成功验证后没有 Playwright 资产发生变更却缺少更新后的 receipt

预检失败时，不得把 change 展示为可归档。报告具体过期或不一致产物，并进入最终确认决策流程；重新验证成功前归档不可用。

不得编辑 `.harness-comet/manifest.json`、receipt 或 fingerprints 伪造新鲜度。

### 2. 归档前最终确认（阻塞点）

入口验证和适用的 Harness 预检通过后，必须按 `comet/reference/decision-point.md` 暂停并等待明确确认。确认前不得运行归档脚本。

展示简短摘要：

- change 名称
- 验证报告路径和结论
- 分支处理状态
- 适用的 Playwright 目标、receipt 路径、receipt 状态和 archive-check 结果
- 不可逆动作：按 OpenSpec delta 语义合并主 spec、标注 Design Doc 和 plan、移动活跃 change 到 archive 目录

使用单选题：

- **确认归档** — 立即运行归档脚本
- **需要调整或重新验证** — 不归档；回到 Verify 并调用 `/comet-verify`
- **暂不归档** — 保持 `phase: archive`，等待稍后再次调用 `/comet-archive`

用户选择重新验证后才执行：

```bash
"$COMET_BASH" "$COMET_STATE" transition <change-name> archive-reopen
```

随后调用 `/comet-verify`。若 Verify 确认需要修复实现，按其验证失败决策流程回到 `/comet-build`。

不得手动编辑 `.comet.yaml`。

### 3. 执行归档

只有用户选择 **确认归档** 后，才运行：

```bash
"$COMET_BASH" "$COMET_ARCHIVE" "<change-name>"
```

官方脚本执行：

1. 入口状态验证（`phase=archive`、`verify_result=pass`、`archived=false`）
2. Design Doc frontmatter 标注（`archived-with`、`status`）
3. plan frontmatter 标注（`archived-with`）
4. OpenSpec archive 按 delta 语义合并并移动 change 目录
5. 主 spec guard，防止残留 delta-only section 标题
6. 执行 `comet-state transition <archive-name> archived` 设置 `archived: true`

脚本返回非零退出码时报告错误并停止；返回 0 表示归档完成。

`X/Y steps succeeded` 只统计真实执行步骤，不重复计算 spec 同步或文档标注。

OpenSpec archive 按 `ADDED`、`MODIFIED`、`REMOVED`、`RENAMED` 语义合并主 spec，并验证主 spec 不含 delta-only section 标题。

预览而不执行：

```bash
"$COMET_BASH" "$COMET_ARCHIVE" "<change-name>" --dry-run
```

### 4. 生命周期闭环

```text
brainstorming → delta spec → 实施 → 验证 → Harness 证据保留 → 主 spec 合并 → Design Doc 标注 → 归档
```

## 退出条件

- 适用的 Harness/Playwright 归档预检通过
- 用户明确确认归档
- 归档脚本退出码为 0
- `openspec/changes/archive/YYYY-MM-DD-<change-name>/` 存在
- 归档后的 `.comet.yaml` 包含 `archived: true`
- 所需验证报告、Harness receipt、results、report 和 fingerprints 可从归档 change 或记录的持久路径获取

归档脚本将：

```text
openspec/changes/<name>/
```

移动到：

```text
openspec/changes/archive/YYYY-MM-DD-<name>/
```

> **WARNING：** 归档成功后，不要再针对旧活跃 change 名运行 `"$COMET_BASH" "$COMET_GUARD" <change-name> archive`。活跃目录已不存在。归档完整性以归档脚本退出码和归档目录状态为准。

## 完成

Comet 流程完成。新工作使用 `/comet` 或 `/comet-open`。

## 上下文压缩恢复

按 `comet/reference/context-recovery.md` 执行，phase 为 `archive`。若 `archived: true` 且归档目录存在，归档已经完成；不得重复执行归档操作。
