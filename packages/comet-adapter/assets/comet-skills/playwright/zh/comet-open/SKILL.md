---
name: comet-open
description: "Comet 阶段 1：Open。完整保留上游 Open 工作流，并集成 Playwright 影响分析与编写决策。"
---

# Comet 阶段 1：Open

<!--
由 @hapergg/harness-comet 管理。
上游基线：https://github.com/rpamis/comet/tree/master/assets/skills/comet-open
此托管副本完整保留上游流程，并增加 Harness/Playwright 步骤。
不要直接修改已安装副本。
-->

## 前置条件

- 当前没有活动 change，或用户希望创建一个新 change

## 步骤

### 0. 输出语言约束

传给 OpenSpec 的每个提示和 artifact 请求都必须包含输出语言约束：使用触发当前工作流的用户请求语言。恢复已有 change 时，如果 artifacts 已有明确主语言，则继续使用该语言，除非用户明确要求切换。

### 1. 探索想法并澄清需求

**立即执行：** 使用 Skill 工具加载 `openspec-explore`。禁止跳过此步骤。

加载后，按照其指导探索问题空间，但不能把一轮问答视为充分澄清。持续提问并与用户对齐，形成包含以下内容的澄清摘要：

- 目标：用户真正想解决的问题和预期结果
- 非目标：明确不在本次 change 范围内的内容
- 范围边界：包含和排除的模块、用户、平台或数据
- 关键未知项：尚未解决的假设、风险或依赖
- 草拟验收场景：至少包含核心成功场景和重要边界场景

澄清摘要必须包含以上五项。

### 1a. PRD 拆分预检（阻塞点）

当用户输入是大型 PRD、路线图、完整产品计划，或澄清摘要显示存在多个独立能力、模块、用户旅程或里程碑时，必须在创建 OpenSpec artifacts 前评估是否应拆分为多个 changes。

每个建议拆分项必须包含：

- 建议的 change 名称
- 目标和范围边界
- 明确的非目标
- 依赖关系或建议执行顺序
- 核心验收场景

满足任一条件时应建议拆分：

- 多个能力可以独立设计、构建、验证和归档
- 多个模块或用户旅程可以独立交付
- 存在明确的阶段性里程碑
- 预计会产生多个 delta specs 或超过三个大型任务
- 某一部分失败或延期不应阻塞其他部分进入后续阶段

建议拆分时，按照 `comet/reference/decision-point.md` 暂停并等待用户选择。选项必须包含：

- **创建多个 OpenSpec changes**
- **全部保留在一个 change 中** —— 在 proposal/design/tasks 中记录不拆分原因
- **调整拆分方案后继续**

每个被接受的拆分项都必须通过 `/comet-open` 进入，不能直接调用 `/opsx:new`，以确保同时创建 OpenSpec artifacts 和 `.comet.yaml`。

用户完成拆分选择前，禁止创建 `proposal.md`、`design.md` 或 `tasks.md`。批量拆分模式下，当前调用负责协调已确认拆分，然后按用户确认的顺序为每个条目进入 `/comet-open`。

每个批量条目必须明确标记为“已确认拆分项”，并携带其目标、范围、非目标和验收场景。除非该条目本身仍明显包含多个独立能力，否则默认跳过本预检。

单个批量条目完成 open 阶段后不得自动进入 `/comet-design`。所有拆分项创建完成后，暂停并询问用户先启动哪个 change，只推进用户选择的一个。

恢复时不要增加专用批量状态文件。已经存在且包含 `.comet.yaml` 的活动 changes 不得重复创建；按照已确认拆分列表继续创建尚未创建的条目。如果无法从对话恢复拆分列表，必须让用户重新确认。

### 1b. 需求澄清完成确认（阻塞点）

创建 OpenSpec artifacts 前，按照 `comet/reference/decision-point.md` 展示完整澄清摘要，并等待用户明确确认。

确认前禁止创建 `proposal.md`、`design.md` 或 `tasks.md`。除非用户明确要求一次性生成，否则禁止加载 `openspec-propose` 一次生成全部 artifacts。

### 1c. Change 名称确认（阻塞点）

创建 change 目录前，按照 `comet/reference/decision-point.md` 让用户决定名称。不得静默推断或自动接受名称。

OpenSpec change 名称必须是 kebab-case 英文，只使用小写字母、数字和连字符。

需要展示：

- 两到三个推荐的 kebab-case 英文名称，每个附一行范围说明
- 明确的自定义名称选项
- 说明不合规输入会被转换为合规 kebab-case 英文，并再次展示给用户确认

最终名称确认前，禁止执行 `openspec new change` 或创建 `.comet.yaml`。如果名称与已有 change 冲突，报告冲突并要求选择其他名称。

### 2. 创建 Change 结构并初始化状态

**立即执行：** 使用 Skill 工具加载 `openspec-new-change`。禁止跳过此步骤。

默认禁止加载 `openspec-propose`。仅当用户明确要求一次性生成 artifacts 时才加载。

遵循 `openspec-new-change`，但如果步骤 1b 已有确认过的澄清摘要，则覆盖其默认停止行为，直接使用该摘要。如果没有确认摘要，则回退到向用户提问。

按照标准 artifact 循环逐个生成 `proposal`、`design` 和 `tasks`。

对每个 artifact（`proposal` → `design` → `tasks`）：

1. 执行 `openspec status --change "<name>" --json`。
2. 执行 `openspec instructions <artifact-id> --change "<name>" --json`。
3. 阅读 `dependencies` 中列出的每个已完成依赖 artifact。
4. 使用 `template` 作为结构并遵循 `instruction`。
5. 将 `context` 和 `rules` 作为约束，但不得复制进 artifact 内容。
6. 写入 `resolvedOutputPath`。
7. 验证文件存在且非空。
8. 再次执行 status 后才继续下一个 artifact。

如果 instructions 执行失败、返回无效 JSON、报告依赖未满足，或没有可用输出路径，立即停止并报告 OpenSpec 错误。禁止退回硬编码文本。

已确认的 change 名称和范围是强约束：不得自行重命名、扩大或缩小范围。

确认以下结构存在：

```text
openspec/changes/<name>/
├── .openspec.yaml
├── .comet.yaml
├── proposal.md
├── design.md
└── tasks.md
```

初始化 Comet 状态：

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"

if [ -z "$COMET_STATE" ] || [ -z "$COMET_GUARD" ]; then
  echo "ERROR: Comet scripts not found. Ensure the comet skill is installed." >&2
  return 1
fi

"$COMET_BASH" "$COMET_STATE" init <name> full
```

### 3. 入口状态验证

执行：

```bash
"$COMET_BASH" "$COMET_STATE" check <name> open
```

通过后才能继续。

**幂等性：** 如果 `.comet.yaml` 已位于 `phase: open`，且三个 artifact 文件都存在，则跳过已完成工作，从第一个缺失步骤继续。

### 4. 内容完整性检查

确认：

- `proposal.md` 包含问题背景、目标、范围和非目标
- `design.md` 包含高层架构决策、方案选择和数据流
- `tasks.md` 包含清晰的复选框任务
- 三个文件都存在且非空

如有文件缺失或为空，返回 artifact 创建步骤。禁止进入评审或执行任何阶段 guard。

### 5. Playwright 影响分析

如果 `harness-comet.config.ts` 解析为 `mode: "playwright"`：

1. 立即加载 `playwright-impact-analysis`。
2. 分析已确认需求、OpenSpec artifacts、相关生产代码、已有 `*.spec.*` 文件、fixtures、Page Objects、测试数据和支持工具。
3. Open 阶段禁止修改 Playwright assets。
4. 将规范化结果写入 `proposal.md`：

```md
## Playwright Impact Analysis
```

该章节必须识别：

- 变化的用户可见行为或系统行为
- 受影响的已有测试
- 覆盖缺口
- 精确证据路径
- 推荐的目标级操作
- 置信度和未解决不确定性

非 Playwright 模式则跳过此步骤，不改变上游流程。

### 6. 合并用户评审与 Playwright 编写决策（阻塞点）

完成完整性检查和影响分析后，按照 `comet/reference/decision-point.md` 暂停，进行一次合并确认。确认前不得执行任一 guard 或自动流转。

展示：

- proposal 的背景、目标和范围
- design 的关键决策和方案
- task 数量和关键任务
- Playwright 行为变化
- 受影响的已有测试和建议
- 建议新建覆盖的未覆盖行为

非 Playwright 项目保留上游单选项：

- **确认，进入下一阶段**
- **需要调整**

Playwright 项目立即在 `comet` 上下文加载 `playwright-authoring-decision`。合并决策必须允许用户：

- 确认 artifacts 并接受建议
- 确认并自定义目标级操作
- 确认但跳过 Playwright 编写
- 请求调整

将规范化结果写入 `proposal.md`：

```md
## Playwright Authoring Decision
```

仅使用目标级操作：`verify`、`update`、`create`、`retire` 或 `ignore`。不得向用户暴露旧的全局 action 名称。

启用编写时，确保 `tasks.md` 包含明确的 Playwright 规划、实现和验证任务。

用户请求调整时，更新对应 artifacts，按需重新执行完整性检查和影响分析，然后再次请求确认。

### 7. Harness-Comet Open Gate

Playwright 模式下，在原生 Comet guard 前执行：

```bash
pnpm exec harness-comet comet hook open --change <change-name>
```

失败时修复报告的 Open artifacts 并重新执行。不得编辑 `.harness-comet/manifest.json` 伪造成功。

## 退出条件

以下条件必须全部满足：

- proposal、design 和 tasks 存在且完整
- 用户已确认 Open artifacts
- Playwright 模式下，已记录影响分析和目标级编写决策
- Playwright 模式下，Harness-Comet Open gate 通过
- 原生 Comet guard 使用 `--apply` 通过

执行：

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> open --apply
```

必须使用 `--apply`。完整工作流进入 design；hotfix/tweak preset 直接进入 build。

## 自动交接到下一阶段

遵循 `comet/reference/auto-transition.md`：

```bash
"$COMET_BASH" "$COMET_STATE" next <change-name>
```

- `NEXT: auto` → 调用 `SKILL` 指定的 skill
- `NEXT: manual` → 不自动调用；提示用户运行 `/<SKILL>`
- `NEXT: done` → 工作流完成

Hotfix/tweak preset 仍由对应 preset skill 控制。批量拆分模式下，不得自动推进单个拆分项；等待用户选择下一个 change。
