---
name: comet-archive
description: "Comet 阶段 5：归档。用 /comet-archive 调用。"
---

# Comet 阶段 5：归档

## 前置条件

- 验证通过
- 分支已处理
- `.comet.yaml` 中 `verify_result: pass`

## 步骤

### 0. 入口状态验证

按现有 Comet archive 入口检查执行，失败时停止。

<!-- HARNESS-COMET:BEGIN archive-project-knowledge -->
### 1. 项目知识更新

归档前检查并按需更新：

- `.agents/rules.md`
- `.agents/structure.md`

读取 change 的 proposal、design、tasks、specs、Design Doc、实施 Plan、验证报告、代码和目录变化，以及当前上下文中仍可获得的用户明确表达。完整聊天记录不是必需条件。

#### 规则提炼

只有用户明确表达、适用于后续多个任务、属于项目级开发约束或工程准则的内容，才可作为候选规则。不得把 Agent 自行推断的最佳实践、当前需求、实现细节、临时方案或一次性限制写入规则。

将候选规则与现有 `rules.md` 按语义比较，由模型判断无需修改、新增、合并或细化、冲突。不得直接写入，先展示来源和明确 diff。

#### 结构更新

只有主要模块、重要目录、模块职责、能力迁移、公共能力、重要入口、依赖方向或测试组织方式发生长期变化时，才更新 `structure.md`。普通文件新增、内部实现调整和临时结构不应更新。结构文档描述逻辑职责，不复制完整文件树。

#### 用户确认

存在更新时，必须先展示两个文件的具体 diff 和依据，并提供：

- 应用全部更新
- 逐项调整
- 跳过知识更新
- 暂不归档

只有用户明确确认后才写入；写入后重新读取并确认与已披露 diff 一致。无可信更新时明确说明并继续。
<!-- HARNESS-COMET:END archive-project-knowledge -->

<!-- HARNESS-COMET:BEGIN archive-preflight -->
### 2. Harness/Playwright 归档预检

项目知识更新完成、跳过或无需更新后，运行：

```bash
pnpm exec harness-comet comet archive-check --change <change-name>
```

确认 receipt、results、report、fingerprints、目标、操作、证据和 incident 绑定仍然有效。失败时返回重新验证或保持 Archive 状态，不得伪造验证资产。
<!-- HARNESS-COMET:END archive-preflight -->

### 3. 归档前最终确认

展示 change、验证结果、分支状态、项目知识更新结果和不可逆归档动作。提供确认归档、重新调整或验证、暂不归档三个选项。

### 4. 执行归档

执行现有 Comet archive 脚本，完成 spec 合并、Design Doc 和 Plan 标注、change 移动及 archived 状态更新。

### 5. 生命周期闭环

```text
brainstorming → delta spec → 实施 → 验证 → 项目知识更新 → 主 spec 合并 → 归档
```

## 退出条件

- 归档脚本成功
- archive 目录存在
- `.comet.yaml` 中 `archived: true`
