---
name: comet-verify
description: "Comet 阶段 4：验证与收尾。用 /comet-verify 调用。完整保留官方中文 Verify 工作流，并集成确定性的 Harness/Playwright 验证。"
---

# Comet 阶段 4：验证与收尾（Verify）

<!--
由 @hapergg/harness-comet 管理。
官方中文上游基线：https://github.com/rpamis/comet/tree/master/assets/skills-zh/comet-verify
此托管副本完整保留官方中文流程，并增加 Harness/Playwright 验证。
不要直接修改已安装副本。
-->

## 前置条件

- 代码已提交（阶段 3 完成）
- `tasks.md` 全部任务已完成

## 步骤

### 0a. 输出语言约束

验证报告和分支处理说明必须使用触发本次工作流的用户请求语言。

### 0b. 入口状态验证（Entry Check）

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
if [ -z "$COMET_STATE" ] || [ -z "$COMET_GUARD" ] || [ -z "$COMET_HANDOFF" ]; then
  echo "ERROR: Comet scripts not found. Ensure the comet skill is installed." >&2
  return 1
fi
"$COMET_BASH" "$COMET_STATE" check <change-name> verify
```

验证通过后继续。

**幂等性：** 如 `verify_result: pass` 且 `branch_status: handled`，验证已完成，直接运行 guard 流转。如 `verify_result: pending`，从头开始验证。

### 1. 改动规模评估

```bash
"$COMET_BASH" "$COMET_STATE" scale <change-name>
```

脚本设置 `verify_mode` 为 `light` 或 `full`。满足任一条件即使用 full：

- 任务数 > 3
- delta spec capability 数 > 1
- 变更文件数 > 4

验证开始前，按 `comet/reference/dirty-worktree.md` 处理未提交改动。

Verify 特殊规则：

1. 属于当前 change 的实现、测试、tasks、delta spec 或 Design Doc dirty diff，不得在 Verify 直接修复或提交；报告并进入失败决策。
2. 验证报告草稿或分支处理记录等 Verify 本阶段产物可以继续保留。
3. 已实施但 tasks 未勾选视为 Build 状态滞后；报告并进入失败决策。

只有用户选择修复后才允许回退：

```bash
"$COMET_BASH" "$COMET_STATE" transition <change-name> verify-fail
```

`verify-fail` 不重置 `branch_status`。再次验证时保留已完成分支处理状态。

工作区 diff 可能低估已提交任务规模，必须读取 plan 文件头 `base-ref` 复核完整提交区间：

```bash
PLAN=$("$COMET_BASH" "$COMET_STATE" get <change-name> plan)
BASE_REF=$(grep '^base-ref:' "$PLAN" 2>/dev/null | head -1 | sed 's/^base-ref: *//')
git diff --stat "$BASE_REF"...HEAD
```

超过 light 阈值或跨模块时设置：

```bash
"$COMET_BASH" "$COMET_STATE" set <change-name> verify_mode full
```

用户或 agent 可在有理由时显式覆盖 `verify_mode light|full`。

### 1b. 验证失败决策（阻塞点）

验证不通过时必须按 `comet/reference/decision-point.md` 暂停。不得自动执行 `verify-fail` 或调用 `/comet-build`。

必须展示：

- 每个失败项
- 严重级别：CRITICAL、IMPORTANT、WARNING、SUGGESTION
- 推荐处理方式
- 受影响目标与证据

CRITICAL 仅用于构建失败、测试失败或安全问题。不确定时必须降级。

选项：

- **全部修复**：执行 `verify-fail`，再调用 `/comet-build`
- **逐项处理**：CRITICAL/IMPORTANT 必须修复；WARNING/SUGGESTION 可接受，但需持久化记录原因与影响范围

存在 CRITICAL 或 IMPORTANT 时不得“全部接受”。

连续三次 verify-fail 后，第 4 次失败必须暂停，仅提供：

- 接受所有允许偏差并记录
- 继续修复

### 2. 产物上下文加载（Hash 按需读）

```bash
RECORDED_HASH=$("$COMET_BASH" "$COMET_STATE" get <change-name> handoff_hash)
CURRENT_HASH=$("$COMET_BASH" "$COMET_HANDOFF" <change-name> --hash-only 2>/dev/null || echo "")
```

两者均非空、非 `null` 且相等时，`tasks.md` 无需全文重读，可只检查未勾选数量；但 `proposal.md`、`design.md`、delta specs 和技术 Design Doc 仍必须读取。

hash 不同或缺失时，完整读取所有所需产物。

**立即执行：** 加载 Superpowers `verification-before-completion`。禁止跳过。

随后按 `verify_mode` 分支执行。

### 2a. 轻量验证（小改动）

执行 6 项检查：

1. `tasks.md` 全部 `[x]`
2. 变更文件与任务描述一致，必要时使用完整 `base-ref...HEAD`
3. 项目对应 build 通过
4. 相关 tests 通过
5. 无明显安全问题、硬编码密钥或新增 unsafe 操作
6. 轻量代码审查通过

`review_mode: standard|thorough` 时加载 Superpowers `requesting-code-review`，输入仅限本次 diff、tasks 和必要测试证据，只检查正确性、安全和边界条件。

`review_mode: off` 时跳过自动审查，但必须记录原因。不得跳过 build、tests、安全检查或调试规则。

6 项全部 OK 且无 CRITICAL/IMPORTANT 才通过。

用 6 行简表报告 PASS/FAIL。失败时进入 Step 1b，只有用户选择修复后才执行 `verify-fail`。

轻量验证明确不检查深度 spec scenario 覆盖、Design Doc 深度一致性、不影响正确性的风格建议以及 delta spec/Design Doc 漂移。

### 2b. 完整验证（大改动）

**立即执行：** 加载 `openspec-verify-change`。禁止跳过。

验证：

1. 所有 tasks 完成
2. 实现符合 `openspec/changes/<name>/design.md`
3. 实现符合技术 Design Doc
4. capability spec 场景全部通过
5. proposal 目标已满足
6. delta specs 与 Design Doc 无矛盾
7. 关联 Design Doc 存在且属于当前 change
8. 项目 build 和相关 tests 有新鲜通过证据
9. 无未解决 CRITICAL/IMPORTANT review 或安全问题

失败时报告缺失或矛盾项并进入 Step 1b。Verify 阶段不得直接修复实现。

#### Spec 漂移决策

发现 delta spec 与 Design Doc 冲突时，以单选方式暂停：

- **追加 Implementation Divergence** 到 Design Doc 后继续；该 Verify 产物不得再次触发 dirty-worktree 决策
- **回到 Build**：执行 `verify-fail`，由 Build 的 brainstorming 规则更新 Design Doc 和 delta spec
- **接受偏差**：继续验证；Archive 时 Design Doc 标记为 `superseded-by-main-spec`

不得自动选择。

### 2c. Harness/Playwright Change 验证

原生 light/full 验证通过后、分支收尾前，判断项目是否为 Playwright 模式，以及 change 是否包含 `Playwright Authoring Decision` 或 Playwright plan。

Verify 阶段不得创建、更新、退役、重设计或修复 Playwright assets。

执行：

```bash
pnpm exec harness-comet comet verify --change <change-name>
```

确定性命令必须：

- 只执行已声明可运行目标
- 排除 `ignore` 和已退役目标
- 确保 `verify` 目标未在无新决策时被修改
- 要求 Harness reporter 输出
- 验证声明目标覆盖率
- 校验目标路径、操作、标签、断言、真实应用边界和证据
- 写入 results、report、receipt 和 fingerprints
- 无可运行目标时生成明确 not-applicable receipt

记录：

- 每个目标及操作
- runnable、skipped、ignored、retired 状态
- 命令与退出状态
- results 路径
- report 路径
- receipt 路径
- fingerprints
- evidence 数量与缺失证据

Harness 验证失败时，报告精确目标与证据并进入 Step 1b。只有用户选择修复后才回到 Build。目标范围或决策必须变化时，通过正确的 Build/Design 流程返回，禁止在 Verify 重设计。

### 3. 收尾（Superpowers）

只有原生验证与 Harness 验证通过，或 Harness 生成明确 not-applicable receipt 后：

**立即执行：** 加载 Superpowers `finishing-a-development-branch`。禁止跳过。

技能不可用时停止并提示安装或启用，不得用普通对话替代。

分支处理选项：

1. 本地合并到主分支
2. 推送并创建 PR
3. 保持分支稍后处理
4. 丢弃工作

这是 `decision-point.md` 下的阻塞式用户决策。不得按推荐或当前分支状态自动选择。

只有对应操作完成后才写 `branch_status: handled`。

确认全部 tests 通过，且无硬编码密钥或安全问题。

### 4. 记录验证证据

验证报告必须落盘，并包含：

- verify mode 与原生检查结果
- 新鲜 build/test 命令证据
- 已接受偏差及原因和影响
- 分支处理结果
- Playwright 目标、操作、执行状态、results/report/receipt 路径、fingerprints、evidence 数量及 not-applicable 原因

```bash
mkdir -p docs/superpowers/reports

"$COMET_BASH" "$COMET_STATE" set <change-name> verification_report docs/superpowers/reports/YYYY-MM-DD-<change-name>-verify.md
"$COMET_BASH" "$COMET_STATE" set <change-name> branch_status handled
```

不得手动设置 `verify_result: pass`。

## 退出条件

- 原生验证通过
- Harness/Playwright 验证通过或生成有效明确 not-applicable receipt
- 验证报告存在并已记录
- 所需 Harness results、report、receipt、fingerprints 存在
- 分支处理完成
- `branch_status: handled`
- 无未解决 CRITICAL/IMPORTANT
- 官方 Verify guard 使用 `--apply` 通过

执行：

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> verify --apply
```

状态推进到 `phase: archive`、`verify_result: pass`，并记录 `verified_at`。

## 自动衔接下一阶段

按 `comet/reference/auto-transition.md`：

```bash
"$COMET_BASH" "$COMET_STATE" next <change-name>
```

- `NEXT: auto` → 调用 `SKILL` 指向的 skill
- `NEXT: manual` → 不调用下一 skill，提示用户运行 `/<SKILL>`
- `NEXT: done` → 流程完成

`comet-archive` 启动后仍必须在最终归档确认阻塞点暂停。Verify 通过绝不代表可以自动归档。

## 上下文压缩恢复

按 `comet/reference/context-recovery.md` 执行，phase 为 `verify`。
