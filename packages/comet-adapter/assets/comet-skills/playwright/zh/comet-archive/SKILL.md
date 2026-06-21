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

只有主要模块或目录、模块职责、能力迁移、项目级公共能力、重要入口、依赖方向或测试资产组织方式发生长期变化时才提出更新。普通文件新增、内部实现调整和临时结构不应写入。文档应描述逻辑职责，不复制完整文件树。

#### 1d. 披露并确认

展示两个文件的明确 diff 和依据，并提供：应用全部更新、逐项调整、跳过知识更新、暂不归档。只有用户确认后才写入；写入后重新读取并确认结果与已披露 diff 一致。
<!-- HARNESS-COMET:END archive-project-knowledge -->

<!-- HARNESS-COMET:BEGIN archive-preflight -->
### 2. Harness/Playwright 归档预检

项目知识更新完成、被用户跳过或确认无需更新后，如果项目为 Playwright 模式且 change 有 Playwright 决策、规划或 Harness receipt，运行：

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
