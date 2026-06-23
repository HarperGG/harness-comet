---
name: comet-archive
description: "Comet 阶段 5：归档。用 /comet-archive 调用。按 OpenSpec delta 语义合并主 spec，归档 change。"
---

# Comet 阶段 5：归档（Archive）

## 前置条件

- 验证已通过（阶段 4 完成）
- 分支已处理
- `openspec/changes/<name>/.comet.yaml` 中 `verify_result: pass`

## 步骤

### 0. 输出语言约束

归档摘要和生命周期闭环说明必须使用触发本次工作流的用户请求语言。

### 0b. 入口状态验证（Entry Check）

执行入口验证：

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
"$COMET_BASH" "$COMET_STATE" check <name> archive
```

验证通过后继续 Step 1。验证失败时脚本会输出具体失败原因。

<!-- HARNESS-COMET:BEGIN archive-project-knowledge -->
### 1. 项目知识更新

在 Harness/Playwright 归档预检和最终归档确认前，检查本次已完成 change 是否需要更新长期项目知识。

项目知识文件为：

```text
.agents/rules.md
.agents/structure.md
```

文件不存在时创建最小基础文件，并保留与本次 change 无关的现有内容。

#### 1a. 读取依据

综合读取 proposal、design、tasks、specs、Design Doc、实施 Plan、验证报告、当前项目知识文件、仓库变化，以及当前上下文中仍可获得的用户明确表达。完整聊天记录不是必需条件，归档材料和仓库变化是主要依据。

#### 1b. 提炼项目规则

只有内容来自用户明确表达、适用于后续工作，并属于项目级约束、工程准则、测试要求、协作约定或 Agent 行为要求时，才提出候选规则。不得自行补充通用最佳实践，也不得把需求内容、实现细节、临时方案或一次性限制提升为项目规则。

将候选规则与 `.agents/rules.md` 按语义比较，判断为无需修改、新增、合并或细化、冲突。不得直接写入，必须先展示拟议 diff 和依据。

#### 1c. 更新项目结构

先比较仓库变化与 `.agents/structure.md` 当前描述，不得仅凭“是否属于现有模块”判断无需更新。

满足以下任一条件时，必须提出 `.agents/structure.md` 更新候选：

1. 文档已列举某目录、业务域或模块的子目录、子页面或子能力，而本次 change 在同一层级新增、删除、重命名或迁移长期子项。
2. 新增或移除用户可访问页面、路由或业务入口、长期 API 域、状态模块、公共组件域、测试旅程类型或项目级工具入口。
3. proposal、design、spec 或归档后主 spec 新增或删除 capability，但对应业务域没有准确覆盖它的结构描述。
4. 现有结构说明的路径、职责、模块边界或能力列表已与仓库事实不一致。

“属于现有模块内部”不能单独作为无需更新的理由。若文档已经枚举同层级子能力，新增同层级能力默认视为结构变化。普通实现文件、局部重构、临时目录、生成产物和不改变长期职责的辅助文件可以不写入，但需要说明原因。

#### 1c-1. 结构变化触发器

归档前读取本次 change 的新增、删除、重命名和迁移文件列表。页面与路由、`src/api/**`、`src/services/**`、状态和领域模型、项目入口和公共能力、长期测试资产，以及 `.agents/structure.md` 已明确列举目录的变化，都需要进入结构影响评估。

命中触发器不等于一定更新，但需要输出结构影响判断。不要只依赖固定框架或固定文件名；优先检查文档已提及路径是否发生同层级扩展。

#### 1c-2. Capability 与结构文档交叉检查

从 proposal、delta spec 和归档后将进入主 spec 的内容中提取新增或删除的 capability，逐项确认它是否对应页面、模块、API 域、入口或长期测试资产，以及 `.agents/structure.md` 是否有准确覆盖。没有覆盖时提出更新候选；决定不更新时展示原因并请求用户确认。不得仅因为 capability 位于现有业务域下就跳过。

#### 1d. 结构影响判断与确认

无论最终是否修改 `.agents/structure.md`，都先展示“项目结构影响”判断块，包括受影响业务域、变化路径、长期能力或职责变化、当前枚举状态、spec 或 proposal 中的新 capability、结论和依据。

结论为“无需更新”时，依据需要说明这些路径为何只是实现细节、为什么不会使文档与仓库事实不一致，以及为什么不属于已枚举模块的同层级扩展。缺少判断块时，不得进入 Harness/Playwright archive-check。

展示两个文件的明确 diff 和依据，并提供：应用全部更新、逐项调整、跳过知识更新、暂不归档。只有用户确认后才写入；写入后重新读取并确认结果与已披露 diff 一致。

只有以下情形可进入 archive-check：用户确认并应用知识更新；已展示完整判断且结论为无需更新；或已展示候选但用户明确跳过并记录原因。仅输出“无需更新”而没有判断和依据，不视为完成。
<!-- HARNESS-COMET:END archive-project-knowledge -->

<!-- HARNESS-COMET:BEGIN archive-preflight -->
### 2. Harness/Playwright 归档预检

只有项目知识更新已由用户确认并应用、已展示完整结构影响判断且结论为无需更新，或用户在看到候选后明确跳过并记录原因，才允许进入本步骤。如果项目为 Playwright 模式且 change 有 Playwright 决策、规划或 Harness receipt，运行：

```bash
pnpm exec harness-comet comet archive-check --change <change-name>
```

确认验证 receipt 为通过或明确 not-applicable；receipt、results、report 和 fingerprints 仍然新鲜；目标和操作一致；证据路径存在；ignored 和 retired 目标一致；incident 绑定有效；验证后没有 Playwright 资产变化却缺少更新后的 receipt。

预检失败时不得把 change 展示为可归档。按上游流程重新验证或保持 Archive 状态。不得编辑 manifest、receipt 或 fingerprints 伪造新鲜度。
<!-- HARNESS-COMET:END archive-preflight -->

### 3. 归档前最终确认（阻塞点）

项目知识更新和归档预检完成后，**必须按 `comet/reference/decision-point.md` 的协议暂停并等待用户确认是否立即归档**。不得在用户确认前运行 `"$COMET_BASH" "$COMET_ARCHIVE" "<change-name>"`。

确认前必须向用户展示简短摘要：
- change 名称
- 验证报告路径和结论
- 分支处理状态
- 项目知识更新结果：已更新、无需更新或用户选择跳过
- 本次归档将执行的不可逆动作：按 OpenSpec delta 语义合并主 spec、标注 design doc / plan、移动 change 到 archive 目录

用户确认问题必须以单选题形式呈现，包含以下选项：
- 「确认归档」— 立即执行归档脚本，完成 spec 合并和 change 移动
- 「需要调整或重新验证」— 不执行归档；运行 `"$COMET_BASH" "$COMET_STATE" transition <change-name> archive-reopen` 回到 `phase: verify`，再调用 `/comet-verify`。若验证阶段确认需要修复，再按 `/comet-verify` 的验证失败决策回到 `/comet-build`
- 「暂不归档」— 不执行归档，保留当前 `phase: archive` 状态，等待用户稍后再次调用 `/comet-archive`

只有用户选择「确认归档」后，才允许继续 Step 4。用户选择「需要调整或重新验证」后，必须先执行 `archive-reopen` 状态回退，不得手动编辑 `.comet.yaml`。

### 4. 执行归档

运行归档脚本，自动完成以下全部步骤：

```bash
"$COMET_BASH" "$COMET_ARCHIVE" "<change-name>"
```

脚本自动执行：
1. 入口状态验证（phase=archive, verify_result=pass, archived=false）
2. Design doc 前置元数据标注（archived-with, status）
3. Plan 前置元数据标注（archived-with）
4. 调用 OpenSpec archive 按 delta 语义合并主 spec 并移动 change 到归档目录
5. 校验主 spec 未残留 delta-only section 标题
6. 通过 `comet-state transition <archive-name> archived` 更新 `archived: true`

如脚本返回非零退出码，报告错误并停止。
如脚本返回零退出码，归档完成。
脚本摘要中的 `X/Y steps succeeded` 以真实执行步骤计数，不会因 delta spec 同步或文档标注重复累计。

脚本会调用 OpenSpec 归档能力按 `ADDED/MODIFIED/REMOVED/RENAMED` 语义合并主 spec，并在归档后校验主 spec 中没有残留 delta-only section 标题。

如需预览而不实际执行，使用 `--dry-run` 参数。

### 5. 生命周期闭环

Spec 生命周期在此完成：
```
brainstorming → delta spec → 实施 → 验证 → 项目知识更新 → 主 spec 合并 → design doc 标注 → 归档
```

## 退出条件

- 归档脚本执行成功（退出码 0）
- 归档目录 `openspec/changes/archive/YYYY-MM-DD-<change-name>/` 存在
- 归档后的 `.comet.yaml` 中 `archived: true`

归档脚本会把 `openspec/changes/<name>/` 移动到 `openspec/changes/archive/YYYY-MM-DD-<name>/`。

> **WARNING**: 归档成功后**不要再对原 change 名运行** `"$COMET_BASH" "$COMET_GUARD" <change-name> archive`，因为原活跃目录已经不存在。误调会导致 guard 报错"change directory not found"。归档完整性以脚本退出码和归档目录状态为准。

## 完成

Comet 流程全部完成。如需开始新工作，调用 `/comet` 或 `/comet-open`。

## 上下文压缩恢复

按 `comet/reference/context-recovery.md` 执行，phase 参数为 `archive`。若 `archived: true` 且归档目录存在，归档已完成，无需再次执行归档操作。