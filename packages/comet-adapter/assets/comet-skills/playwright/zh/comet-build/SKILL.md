---
name: comet-build
description: "Comet 阶段 3：计划与构建。用 /comet-build 调用。完整保留官方中文 Build 工作流，并集成 Playwright 编写实施与验证。"
---

# Comet 阶段 3：计划与构建（Build）

<!--
由 @hapergg/harness-comet 管理。
官方中文上游基线：https://github.com/rpamis/comet/tree/master/assets/skills-zh/comet-build
此托管副本完整保留官方中文流程，并增加 Harness/Playwright 步骤。
不要直接修改已安装副本。
-->

## 前置条件

- Design Doc 已创建（阶段 2 完成）
- 活跃 change 存在

## 步骤

### 0. 入口状态验证（Entry Check）

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
"$COMET_BASH" "$COMET_STATE" check <name> build
```

验证通过后继续。

**幂等性：** 读取 `.comet.yaml` 确认仍处于 `build`，读取 plan 文件头 `base-ref`，再执行：

```bash
grep -n '\- \[ \]' openspec/changes/<name>/tasks.md | head -1
```

从第一个未勾选任务继续。已完成或已提交工作不得重复执行或重复提交。

### 1. 制定计划（Subagent Offload）

通过 subagent 创建实施计划，避免 planning skill 占用主 session 上下文。计划文件和执行反馈必须使用触发本次工作流的用户请求语言。

规划 subagent 必须：

1. 立即加载 Superpowers `writing-plans`，ARGUMENTS 包含：

   ```text
   Language: 使用触发本次工作流的用户请求语言输出
   ```

2. 读取 `docs/superpowers/specs/` 下的 Design Doc。
3. 读取 `openspec/changes/<name>/tasks.md`。
4. 如存在，读取 `## Playwright Authoring Plan`。
5. 按技能指引生成可执行计划。

计划保存到：

```text
docs/superpowers/plans/YYYY-MM-DD-<feature>.md
```

文件头必须包含：

```yaml
---
change: <openspec-change-name>
design-doc: docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
base-ref: <实施前的 git rev-parse HEAD>
---
```

实施前记录：

```bash
git rev-parse HEAD
```

Playwright 目标必须精确保留已批准路径和操作：

- `verify`：只验证，不计划修改
- `update`：只编辑批准的测试或支持资产
- `create`：只创建批准路径
- `retire`：移除批准目标及引用
- `ignore`：不创建实施任务

不得引入未声明目标。

使用当前平台真实 subagent 调度机制派发规划。若失败或返回无效路径，在主 session 中内联加载 `writing-plans` 作为降级回退。

### 2. 更新计划状态并提供 plan-ready 暂停点

记录计划：

```bash
"$COMET_BASH" "$COMET_STATE" set <name> plan docs/superpowers/plans/YYYY-MM-DD-feature.md
```

随后按 `comet/reference/decision-point.md` 让用户选择：

| 选项 | 行为 | 说明 |
|---|---|---|
| A | 继续执行 | 保持当前模型，进入工作方式选择 |
| B | 暂停切换模型 | 记录 `build_pause: plan-ready` 并停止本次调用 |

不得自动继续，也不得把暂停写入 `build_mode`。

继续时：

```bash
"$COMET_BASH" "$COMET_STATE" set <name> build_pause null
```

暂停时：

```bash
"$COMET_BASH" "$COMET_STATE" set <name> build_pause plan-ready
```

暂停后不得选择隔离方式、执行方式或加载执行技能。

### 3. 选择工作方式

若从 `build_pause: plan-ready` 恢复且 plan 文件存在，不得重新运行 planning。先告知用户当前位于 plan-ready 暂停点，等待确认后清除 pause，再继续。

必须一次性交互询问工作区隔离、执行方式和 TDD 模式。

#### 工作区隔离

| 选项 | 方式 | 说明 |
|---|---|---|
| A | 创建分支 | 当前仓库内简单快速 |
| B | 创建 Worktree | 完全隔离，适合并行开发 |

推荐仅用于建议：变更 ≤ 3 个文件推荐分支；需要并行或当前分支有未提交工作推荐 worktree。

#### 执行方式

| 选项 | 技能 | 适用场景 |
|---|---|---|
| A | `subagent-driven-development` | 独立或复杂任务，需要双阶段审查 |
| B | `executing-plans` | 简单任务或没有真实 subagent 环境 |

推荐仅用于建议：任务 ≥ 3 推荐 subagent；任务 ≤ 2 且无跨模块依赖推荐 executing-plans；hotfix 推荐 executing-plans。

#### TDD 模式

| 选项 | 含义 |
|---|---|
| `tdd` | 每个任务先编写并验证失败测试，再实施 |
| `direct` | 不强制 TDD，直接实施 |

这是阻塞式用户决策，不得根据推荐规则自动选择。

记录：

```bash
"$COMET_BASH" "$COMET_STATE" set <name> isolation <branch|worktree>
"$COMET_BASH" "$COMET_STATE" set <name> tdd_mode <tdd|direct>
```

选择 `executing-plans`：

```bash
"$COMET_BASH" "$COMET_STATE" set <name> subagent_dispatch null
"$COMET_BASH" "$COMET_STATE" set <name> build_mode executing-plans
```

选择 `subagent-driven-development` 时，先确认平台有真实后台 Task/subagent/multi-agent 调度能力，然后记录：

```bash
"$COMET_BASH" "$COMET_STATE" set <name> subagent_dispatch confirmed
"$COMET_BASH" "$COMET_STATE" set <name> build_mode subagent-driven-development
```

无法确认真实调度时，不得设置 subagent 模式，必须暂停让用户改选 `executing-plans`。

`isolation`、`tdd_mode` 和有效 `build_mode` 都是脚本硬约束。

full workflow 不得默认 direct。只有用户明确要求并记录 override 后才允许：

```bash
"$COMET_BASH" "$COMET_STATE" set <name> direct_override true
"$COMET_BASH" "$COMET_STATE" set <name> build_mode direct
```

#### 执行隔离

分支方式需先推荐名称并等待明确确认：

- full → `feature/YYYYMMDD/<change-name>`
- hotfix → `hotfix/YYYYMMDD/<change-name>`
- tweak → `tweak/YYYYMMDD/<change-name>`

确认后：

```bash
git checkout -b <branch-name>
```

worktree 方式必须立即加载 Superpowers `using-git-worktrees`。不得用普通 shell 命令绕过。技能不可用时停止并提示安装或启用。

worktree 创建前若 plan 尚未提交，先提交 plan。

#### 执行计划

`executing-plans`：立即加载 Superpowers `executing-plans`，传入相同语言约束并执行计划。

`subagent-driven-development`：立即加载 Superpowers `subagent-driven-development`，再读取 `comet/reference/subagent-dispatch.md`。主 session 只负责协调，不得直接实施任务。更具体的 Comet 调度、隔离、勾选、TDD、连续执行和恢复规则优先。

若后续发现无真实 subagent 调度能力，暂停让用户选择主窗口执行；用户确认后才将 `build_mode` 改为 `executing-plans`。

#### TDD 执行约束

`tdd_mode: tdd` 且使用 `executing-plans` 时，在第一个任务前加载一次 Superpowers `test-driven-development`，每个任务遵循 Red-Green-Refactor，不得跳过失败测试验证。上下文压缩后恢复时重新加载一次。

subagent 模式下，每个 implementer 和 fix agent 必须按 `comet/reference/subagent-dispatch.md` 自行加载 `test-driven-development`。

`tdd_mode: direct` 不强制 TDD。

#### Executing-Plans Review Gate

`build_mode: executing-plans` 时，全部任务完成后、build guard 前必须加载 Superpowers `requesting-code-review` 并至少请求一次审查。

技能不可用时，在 `tasks.md` 记录：

```md
<!-- review skipped: skill unavailable -->
```

然后继续。

所有 CRITICAL 发现必须在 Verify 前修复。接受非 CRITICAL 发现时必须持久化记录原因和影响范围。

### 3a. Playwright 编写实施

执行到 Playwright 编写任务时：

1. 立即在 `comet` 上下文加载 `playwright-authoring-build`。
2. 将 Design Doc 中已批准的 `Playwright Authoring Plan` 作为精确范围边界。
3. 只实施声明的目标操作和路径。
4. 测试真实应用实现；可以 mock 依赖，但不得 mock 功能本身。
5. 保留已批准断言、标签、fixture、测试数据、Page Object、网络策略和证据要求。
6. 不创建独立 authoring session 文档。
7. 不引入未声明目标。
8. 只有目标级验收和验证通过后才勾选对应任务。

subagent 模式下，每个负责 Playwright 任务的 implementer 或 fix agent 必须在编辑 Playwright 资产前加载 `playwright-authoring-build`。

### 3b. 执行中异常调试（Debug Gate）

运行程序、测试、构建或手动验证时出现崩溃、异常行为、测试失败或构建失败，必须立即加载 Superpowers `systematic-debugging`。

根因调查完成前不得提出或实施源码修复。按 `comet/reference/debug-gate.md` 处理最小复现、修复验证和当前 change 验证闭环。

### 4. Spec 增量更新

按规模处理实施发现：

| 规模 | 触发条件 | 处理方式 |
|---|---|---|
| 小 | 缺少验收场景或边界条件 | 编辑 delta spec 和 `design.md`，追加任务 |
| 中 | 接口、组件或数据流变化 | 暂停确认，加载 `brainstorming`，更新 Design Doc 与 delta spec |
| 大 | 新 capability | 暂停确认拆分，通过 `/comet-open` 创建新 change |

新增任务超过初始任务数 50% 时，必须按 `decision-point.md` 询问是否拆分。

选项必须包含：

- 通过 `/comet-open` 拆分为新 change
- 在当前 change 继续并持久化记录范围扩展

Delta spec 是活文档，每次更新都应以 commit 记录原因。Archive 前不得提前同步到主 spec。

新增 Playwright 目标绝不能作为隐式小改动，必须更新 authoring decision 和 Design Doc 规划后才能实施。

### 5. 上下文管理

Build 可能跨越多个任务：

- 每个任务完成当前执行分支要求的验收后，才能勾选并提交
- 使用未勾选任务数量，不必反复读取完整 tasks
- 上下文压缩后按 `comet/reference/context-recovery.md`，phase 为 `build`
- 用户或手工修改导致 dirty worktree 时按 `comet/reference/dirty-worktree.md`
- 如归因后的 diff 暗示 plan 或 spec 变化，回到 Step 4
- 单个任务超过约 200 行改动时考虑拆分为多个子任务和 commits

### 6. Playwright 编写验证与 Harness Gate

实施和必要代码审查完成后、官方 build guard 前：

1. 立即在 `comet` 上下文加载 `playwright-authoring-verify`。
2. 验证每个已声明且可运行目标。
3. 确认目标路径和操作与已批准决策及规划一致。
4. 确认 `@harness` 标签、需求断言、真实应用边界、fixture、mock 和证据。
5. 确认没有引入合成替代应用或未声明目标。
6. 确认 `verify` 和 `ignore` 目标未被编辑，除非有新的已确认决策。
7. 将结果写入 Design Doc：

   ```md
   ## Playwright Authoring Verification
   ```

8. 执行：

```bash
pnpm exec harness-comet comet hook build --change <change-name>
```

实施有缺陷时回到对应 Build 任务，不得扩大范围。规划不完整或目标范围必须变化时，回到 Design 并重新获得用户决策。

不得编辑 `.harness-comet/manifest.json` 伪造成功。

## 退出条件

- `tasks.md` 全部勾选
- 实施和任务 commits 完成
- 已明确运行并通过项目 build 与 tests
- `isolation` 为 `branch` 或 `worktree`
- `build_mode` 合法，且必要时已确认 dispatch 或 direct override
- `tdd_mode` 为 `tdd` 或 `direct`
- executing-plans review 要求已满足
- 适用时 Playwright 编写验证已记录并通过
- Playwright 模式下 Harness-Comet build gate 通过
- 官方 Comet build guard 使用 `--apply` 通过

官方 guard 优先使用配置命令：

```yaml
build_command: <command>
verify_command: <command>
```

配置可以位于 change `.comet.yaml` 或仓库 Comet 配置文件。只有没有配置命令时，guard 才可回退到 npm、Maven 或 Cargo 自动检测。

执行：

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> build --apply
```

状态推进到 `phase: verify`，并设置 `verify_result: pending`。

## 自动衔接下一阶段

按 `comet/reference/auto-transition.md`：

```bash
"$COMET_BASH" "$COMET_STATE" next <change-name>
```

- `NEXT: auto` → 调用 `SKILL` 指向的 skill
- `NEXT: manual` → 不调用下一 skill，提示用户运行 `/<SKILL>`
- `NEXT: done` → 流程完成
