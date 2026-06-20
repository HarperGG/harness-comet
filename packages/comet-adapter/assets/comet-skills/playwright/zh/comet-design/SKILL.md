---
name: comet-design
description: "Comet 阶段 2：深度设计。用 /comet-design 调用。完整保留官方中文 Design 工作流，并集成 Playwright 编写规划。"
---

# Comet 阶段 2：深度设计（Design）

<!--
由 @hapergg/harness-comet 管理。
官方中文上游基线：https://github.com/rpamis/comet/tree/master/assets/skills-zh/comet-design
此托管副本完整保留官方中文流程，并增加 Harness/Playwright 步骤。
不要直接修改已安装副本。
-->

## 前置条件

- 活跃 change 已存在（`proposal.md`、`design.md`、`tasks.md`）
- `docs/superpowers/specs/` 下无对应 Design Doc

## 步骤

### 0. 入口状态验证（Entry Check）

执行入口验证：

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

"$COMET_BASH" "$COMET_STATE" check <name> design
```

验证通过后继续。

**幂等性：** 所有 design 阶段操作可以安全重试。如果 `handoff_context` 和 `handoff_hash` 已存在，先确认它们与当前产物一致，再决定是否重新生成。

### 1a. 生成 OpenSpec → Superpowers 交接包

**必须由脚本生成，不允许 agent 临场手写 summary 代替。**

```bash
"$COMET_BASH" "$COMET_HANDOFF" <change-name> design --write
```

脚本根据 change `.comet.yaml` 的 `context_compression` 快照生成并记录对应交接包。

默认 `context_compression: off` 时生成：

```text
openspec/changes/<name>/.comet/handoff/design-context.json
openspec/changes/<name>/.comet/handoff/design-context.md
```

beta 模式生成：

```text
openspec/changes/<name>/.comet/handoff/spec-context.json
openspec/changes/<name>/.comet/handoff/spec-context.md
```

并在 `.comet.yaml` 写入 `handoff_context` 和 `handoff_hash`。

默认交接包是 compact 可追溯摘录，不是 agent summary，必须保留 source path、line range、sha256、确定性摘录、必要的 `[TRUNCATED]` 标记和完整源路径。

beta 交接包是结构化 spec projection。OpenSpec delta spec 仍是 canonical spec。projection 缺失、过期或不清晰时，必须重新生成或读取源 spec，不得用 agent summary 替代。

确实需要全文上下文时，显式执行：

```bash
"$COMET_BASH" "$COMET_HANDOFF" <change-name> design --write --full
```

交接包来源包括 `proposal.md`、`design.md`、`tasks.md` 和 `specs/*/spec.md`。

### 1b. 执行 Brainstorming（带上下文）

**立即执行：** 使用 Skill 工具加载 Superpowers `brainstorming` 技能。禁止跳过此步骤。

ARGUMENTS 必须包含：

```text
Language: 使用触发本次工作流的用户请求语言输出
```

提供脚本生成的交接包路径，并保持 OpenSpec 为上游事实源。不得以“上下文已重复”为由削弱原始 brainstorming 澄清流程。

brainstorming 必须覆盖：实现架构与数据流、关键技术选型与风险、测试策略、边界条件、需求或范围缺口、Spec Patch 候选。

如果目标、范围、非目标、验收场景或关键约束仍不清楚，必须继续提问。不得只进行一轮问答就创建 Design Doc。

不得重写 proposal/spec。Spec Patch 只能补充验收场景、修正歧义描述或添加边界条件。涉及结构或范围的大幅变更时，必须将其标记为设计发现，并回到 brainstorming 让用户确认。

Design Doc frontmatter 必须最小化：

```yaml
---
comet_change: <change-name>
role: technical-design
canonical_spec: openspec
---
```

按原始 brainstorming 流程推进：澄清问题、提供两到三个方案、比较取舍、分段确认设计。不得提前写入最终 Design Doc。

如果 `brainstorming` 技能不可用，停止流程并提示安装或启用 Superpowers 技能。不得用普通对话替代。

brainstorming 过程中必须增量维护 `openspec/changes/<name>/.comet/handoff/brainstorm-summary.md`。每轮澄清或方案迭代后，只要确认事实、约束、候选方案、取舍、风险、测试策略或 Spec Patch 候选发生变化，就更新该文件。未确认内容标记为“待确认”或“候选”。该文件是恢复检查点，不是 Design Doc，也不能替代用户确认。

### 1c. 用户确认设计方案（阻塞点）

必须按 `comet/reference/decision-point.md` 的协议暂停并等待用户明确确认设计方案。确认前不得创建最终 Design Doc、写入 `design_doc`、运行任一 design gate，或进入 `/comet-build`。

暂停时只展示必要摘要：采用的技术方案、关键取舍与风险、测试策略，以及如有 Spec Patch 时将回写的 delta spec 变更。

用户要求调整时，继续 brainstorming 迭代，直到用户确认。

### 1d. Brainstorming 检查点定稿

用户确认后，定稿 `openspec/changes/<name>/.comet/handoff/brainstorm-summary.md`，结构必须包含：

```md
# Brainstorm Summary

- Change: <change-name>
- Date: <YYYY-MM-DD>

## 确认的技术方案

## 关键取舍与风险

## 测试策略

## Spec Patch
```

无 Spec Patch 时写“无”。

上下文压缩后恢复时，重新加载 `brainstorm-summary.md`、`design-context.md` 或 beta `spec-context.md`、`design-context.json` 或 beta `spec-context.json`。

### 1e. 主动上下文压缩门

检查点落盘后，如果宿主平台提供原生上下文压缩或清理机制，必须触发一次。不得用 shell 命令伪造压缩。

恢复提示必须包含 change 名称、当前步骤 `Design Step 2`，以及上方交接文件。

如果 agent 无法程序化触发压缩，暂停并提示用户执行宿主平台的手动压缩。用户确认无法压缩或要求继续后，才继续。

### 1f. Playwright 编写规划

如果 `harness-comet.config.ts` 解析为 `mode: "playwright"`，且 `proposal.md` 中的 `Playwright Authoring Decision` 已启用：

1. 立即在 `comet` 上下文加载 `playwright-authoring-plan`。
2. 使用原始需求、`Playwright Impact Analysis`、已确认目标决策、已确认技术方案、OpenSpec 产物、Design 交接包和仓库证据。
3. 不得引入已确认编写决策中不存在的目标。
4. 逐目标生成规划，必须包含需求到断言映射、边界分类、执行路径与生产代码来源、精确测试目标和操作（`verify`、`update`、`create`、`retire`、`ignore`）、要创建/更新/退役的文件、fixture/测试数据/Page Object/网络策略、相关资产与证据路径、验证命令与预期证据。
5. 将规划与已确认技术设计和 Spec Patch 对齐。出现冲突时，回到 brainstorming 和用户确认，不得静默改变范围。

如果用户明确跳过或禁用 Playwright 编写，创建明确的 no-op 规划，并说明不修改 Playwright assets 的原因。

Design 阶段不得修改 Playwright assets。

### 2. 创建 Design Doc

基于完整且已确认的 brainstorming 上下文，创建 `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`，仅使用上方最小 frontmatter。

Playwright 模式下必须包含：

```md
## Playwright Authoring Plan
```

该章节必须保留目标级操作，并包含完整的已确认规划或明确的 no-op 原因。

将已确认 Spec Patch 回写到对应 `specs/*/spec.md`。不得在 Design Doc 中创建第二份需求 spec。

如果上下文已压缩，从定稿检查点和脚本生成的交接包恢复。如果无法确认用户确认状态，返回 Step 1b/1c。

### 3. 更新 Comet 状态并运行 Gates

记录 Design Doc 路径：

```bash
"$COMET_BASH" "$COMET_STATE" set <name> design_doc docs/superpowers/specs/YYYY-MM-DD-topic-design.md
```

如果 Spec Patch 修改了 `specs/*/spec.md`，重新生成交接包：

```bash
"$COMET_BASH" "$COMET_HANDOFF" <change-name> design --write
```

Playwright 模式下，在官方 Comet 阶段守卫之前执行 Harness-Comet design gate：

```bash
pnpm exec harness-comet comet hook design --change <change-name>
```

失败时修复 Design Doc、Playwright 规划、OpenSpec 产物或决策一致性后重新执行。不得编辑 `.harness-comet/manifest.json` 伪造成功。

随后执行官方 Comet 阶段守卫：

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> design --apply
```

## 退出条件

- Design Doc 已创建，且包含要求的最小 frontmatter
- `handoff_context` 和 `handoff_hash` 存在并与当前产物一致
- 脚本生成的交接文件包含 source 和 sha256 可追溯信息
- beta 交接包在启用时结构合法
- 已确认 Spec Patch 已回写
- `design_doc` 已写入 `.comet.yaml`
- Playwright 模式下，Design Doc 包含完整目标级规划或明确 no-op
- 每个启用目标都有规划项
- 没有引入未声明目标
- Playwright 模式下 Harness-Comet design gate 通过
- 官方 Comet design guard 使用 `--apply` 通过，并推进到 `phase: build`

必须使用 `--apply`。

## 上下文压缩恢复

按 `comet/reference/context-recovery.md` 执行，phase 为 `design`。

## 自动衔接下一阶段

按 `comet/reference/auto-transition.md` 执行：

```bash
"$COMET_BASH" "$COMET_STATE" next <change-name>
```

- `NEXT: auto` → 调用 `SKILL` 指向的 skill
- `NEXT: manual` → 不调用下一 skill，提示用户运行 `/<SKILL>`
- `NEXT: done` → 流程已完成
