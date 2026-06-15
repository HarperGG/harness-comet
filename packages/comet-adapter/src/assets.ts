import { REQUIRED_SKILL_ROOT_FILES } from "./compatibility/file-contract.js";
import type { CometLanguage, HarnessCometProjectMode } from "./types.js";

export const PATCHED_SKILL_FILES = [
  "comet-open/SKILL.md",
  "comet-design/SKILL.md",
  "comet-build/SKILL.md",
  "comet-verify/SKILL.md",
  "comet-archive/SKILL.md"
] as const;

type PatchPhase = "open" | "design" | "build" | "verify" | "archive";
const MANAGED_PATCH_VERSION = 2;

const phaseByPath = new Map<string, PatchPhase>([
  ["comet-open/SKILL.md", "open"],
  ["comet-design/SKILL.md", "design"],
  ["comet-build/SKILL.md", "build"],
  ["comet-verify/SKILL.md", "verify"],
  ["comet-archive/SKILL.md", "archive"]
]);

export function getPatchPhase(relativePath: string): PatchPhase {
  const phase = phaseByPath.get(relativePath);
  if (!phase) throw new Error(`Unsupported patched skill: ${relativePath}`);
  return phase;
}

export function buildManagedPatchBlock(
  phase: PatchPhase,
  language: CometLanguage = "en",
  mode: HarnessCometProjectMode = "runtime"
): string {
  const bodyByPhase: Record<CometLanguage, Record<PatchPhase, string>> = mode === "playwright" ? {
    en: {
      open: `## Harness Playwright Impact Decision

Before completing Open:

1. Inspect the requested change.
2. Review existing Playwright tests tagged \`@harness\`.
3. Recommend one action:
   - \`none\`
   - \`verify-existing\`
   - \`update-or-create\`
4. Explain the recommendation and ask the user to confirm it.
5. After confirmation, run:

\`\`\`bash
harness-comet impact set \\
  --change <change-id> \\
  --action <confirmed-action> \\
  --reason "<confirmed-reason>" \\
  --confirmed-by user
\`\`\`

6. Run:

\`\`\`bash
harness-comet comet hook open --change <change-id>
\`\`\`

This command is a mandatory phase gate.

- If it fails, fix the reported issue and rerun it.
- Do not advance until it succeeds.
- Do not choose on behalf of the user when impact is ambiguous.`,
      design: `## Harness Playwright Plan

Read the confirmed Harness Action from \`Harness Playwright Impact\`.

For \`none\`:
- record the reason;
- do not declare target tests.

For \`verify-existing\`:
- explicitly list existing target test paths;
- use only \`verify\` or \`update\`.

For \`update-or-create\`:
- explicitly list all target tests;
- use \`verify\`, \`update\`, \`create\`, or \`retire\`;
- list related test assets;
- declare expected business evidence.

Use this structure:

\`\`\`md
## Harness Playwright Plan

- Action: verify-existing

### Target tests

- path: tests/journeys/example.spec.ts
  operation: verify
  reason: ...

### Related test assets

- path: tests/data/example.json
  reason: ...

### Expected evidence

- save-payload
- final-state
\`\`\`

Run:

\`\`\`bash
harness-comet comet hook design --change <change-id>
\`\`\`

Do not advance until the gate succeeds.`,
      build: `## Harness Playwright Build

Implement the approved Harness Playwright Plan.

- Keep tests as standard Playwright tests.
- Use controlled local data or API mocks.
- Preserve Incident issue bindings.
- Update Design before changing undeclared Harness assets.
- Do not require \`defineHarnessScenario\`.
- Run \`harness-comet validate\`.
- Run:

\`\`\`bash
harness-comet comet hook build --change <change-id>
\`\`\`

Do not complete Build until the gate succeeds.`,
      verify: `## Harness Playwright Verify

Run:

\`\`\`bash
harness-comet comet verify --change <change-id>
\`\`\`

Behavior by Action:

- \`none\`: write a \`not-applicable\` receipt without running Playwright;
- \`verify-existing\`: run only the declared existing targets;
- \`update-or-create\`: run only the declared non-retired targets.

Do not create or redesign tests during Verify.
Return to Design or Build if required assets are missing.
Do not advance until verification succeeds.`,
      archive: `## Harness Playwright Archive

Before archive:

- confirm the latest verification receipt is still fresh;
- confirm required target paths still exist;
- confirm Incident issue bindings remain valid;
- confirm the verification report and results file exist when required.

Run:

\`\`\`bash
harness-comet comet archive-check --change <change-id>
\`\`\`

Do not archive when the receipt is stale or incomplete.`
    },
    zh: {
      open: `## Harness Playwright 影响决策

完成 Open 阶段前：

1. 分析本次需求和变更范围；
2. 查看带有 \`@harness\` tag 的既有 Playwright 测试；
3. 推荐一个 Action：
   - \`none\`
   - \`verify-existing\`
   - \`update-or-create\`
4. 说明推荐理由，并让用户确认最终 Action；
5. 用户确认后执行：

\`\`\`bash
harness-comet impact set \\
  --change <change-id> \\
  --action <confirmed-action> \\
  --reason "<confirmed-reason>" \\
  --confirmed-by user
\`\`\`

6. 执行：

\`\`\`bash
harness-comet comet hook open --change <change-id>
\`\`\`

该命令是强制阶段门禁。

- 失败时修复问题并重新执行；
- 成功前不得进入下一阶段；
- 影响不明确时不得替用户做最终决定。`,
      design: `## Harness Playwright Plan

读取 \`Harness Playwright Impact\` 中已经确认的 Action。

当 Action 为 \`none\`：
- 记录原因；
- 不声明 target tests。

当 Action 为 \`verify-existing\`：
- 明确列出既有测试路径；
- operation 只能使用 \`verify\` 或 \`update\`。

当 Action 为 \`update-or-create\`：
- 明确列出全部目标测试；
- operation 可使用 \`verify\`、\`update\`、\`create\`、\`retire\`；
- 列出相关测试资产；
- 声明预期业务证据。

使用以下结构：

\`\`\`md
## Harness Playwright Plan

- Action: verify-existing

### Target tests

- path: tests/journeys/example.spec.ts
  operation: verify
  reason: ...

### Related test assets

- path: tests/data/example.json
  reason: ...

### Expected evidence

- save-payload
- final-state
\`\`\`

执行：

\`\`\`bash
harness-comet comet hook design --change <change-id>
\`\`\`

门禁成功前不得进入下一阶段。`,
      build: `## Harness Playwright Build

实现已经批准的 Harness Playwright Plan。

- 保持测试为标准 Playwright tests。
- 使用可控的本地数据或 API mock。
- 保留 Incident issue 绑定。
- 修改未声明的 Harness 资产前先更新 Design。
- 不要要求 \`defineHarnessScenario\`。
- 运行 \`harness-comet validate\`。
- 执行：

\`\`\`bash
harness-comet comet hook build --change <change-id>
\`\`\`

门禁成功前不得完成 Build。`,
      verify: `## Harness Playwright Verify

运行：

\`\`\`bash
harness-comet comet verify --change <change-id>
\`\`\`

按 Action 执行：

- \`none\`：不运行 Playwright，直接写入 \`not-applicable\` receipt；
- \`verify-existing\`：只运行已声明的既有 targets；
- \`update-or-create\`：只运行已声明且未 retire 的 targets。

Verify 阶段不得新增或重设计测试。
如果缺少所需资产，回到 Design 或 Build。
验证成功前不得进入下一阶段。`,
      archive: `## Harness Playwright Archive

归档前：

- 确认最新 verification receipt 仍然新鲜；
- 确认必需的 target 路径仍然存在；
- 确认 Incident issue 绑定仍然有效；
- 在需要时确认 verification report 与 results file 存在。

执行：

\`\`\`bash
harness-comet comet archive-check --change <change-id>
\`\`\`

当 receipt 过期或不完整时不得归档。`
    }
  } : {
    en: {
    open: `## Harness-Comet Open Requirements

Before the open phase asks the user to review proposal/design/tasks, choose a
Harness impact mode and update \`openspec/changes/<change-id>/design.md\` with:

\`\`\`md
## Harness Impact

- Mode: full | maintain | off
- Reason:
- Affected capabilities:
  - ...
- Existing asset candidates:
  - scenario: ...
- Asset decisions:
  - reuse | update | extend | create | deprecate | none
\`\`\`

Use:

- \`full\` when the change may add or reshape Harness assets
- \`maintain\` for ordinary changes that must keep existing Harness assets aligned
- \`off\` only when Harness is truly not applicable

When mode is \`full\` or \`maintain\`, also add at least one Harness task to
\`openspec/changes/<change-id>/tasks.md\`, for example:

\`\`\`md
- [ ] Add or update Harness scenario coverage
- [ ] Run harness-comet comet verify before archive
\`\`\`

Run the deterministic open gate before leaving this phase:

\`\`\`bash
harness-comet comet hook open --change <change-id>
\`\`\``,
    design: `## Harness-Comet Design Requirements

If \`Harness Impact\` mode is \`full\` or \`maintain\`, the technical Design Doc
created in this phase must include:

\`\`\`md
## Harness Design

### Impact Mode

- Mode:
- Reason:

### Asset Decision Table

| assetType | assetId | decision | reason | contractChange | evidence |
| --------- | ------- | -------- | ------ | -------------- | -------- |

### Scenario Decision

### Fixture Decision

### Adapter Decision

### Oracle Decision
\`\`\`

Mode guidance:

- \`maintain\` cannot use \`create\`
- Do not create \`-v2\`, \`-new\`, or \`-updated\` scenarios to dodge updating
  an existing contract
- New scenarios require an explicit business-difference explanation

Run the deterministic design gate before leaving this phase:

\`\`\`bash
harness-comet comet hook design --change <change-id>
\`\`\``,
    build: `## Harness-Comet Build Requirements

When \`Harness Impact\` mode is \`full\` or \`maintain\`, implement the Harness
asset decisions declared in the Design Doc before completing build:

- Scenario implementation
- Fixture implementation
- Adapter Action implementation
- Inspector implementation
- Oracle implementation
- Harness validation
- Harness scenario execution

Run the deterministic build gate before leaving this phase:

\`\`\`bash
harness-comet comet hook build --change <change-id>
\`\`\``,
    verify: `## Harness-Comet Verify Requirements

Run deterministic Harness verification for this change:

\`\`\`bash
harness-comet comet verify --change <change-id>
\`\`\`

Do not treat the Comet verify phase as complete when Harness scenarios required
by the change are failing or missing.`,
    archive: `## Harness-Comet Archive Requirements

Before archive, confirm the latest Harness verification receipt still matches
the current git tree, Harness config, and Harness assets:

\`\`\`bash
harness-comet comet archive-check --change <change-id>
\`\`\`

If this check fails, return to verify/build instead of archiving.`
    },
    zh: {
      open: `## Harness 影响分析要求

在 open 阶段请求用户审视 proposal/design/tasks 之前，必须先选择 Harness
参与模式，并更新 \`openspec/changes/<change-id>/design.md\`，加入以下小节：

\`\`\`md
## Harness Impact

- Mode: full | maintain | off
- Reason:
- Affected capabilities:
  - ...
- Existing asset candidates:
  - scenario: ...
- Asset decisions:
  - reuse | update | extend | create | deprecate | none
\`\`\`

使用建议：

- \`full\`：本次需求允许新增或重构 Harness 资产
- \`maintain\`：不新增资产，但必须维护已有资产
- \`off\`：只有明确不适用 Harness 时才可使用

当 mode 为 \`full\` 或 \`maintain\` 时，还必须在
\`openspec/changes/<change-id>/tasks.md\` 中加入至少一个 Harness 任务，例如：

\`\`\`md
- [ ] 添加或更新 Harness 场景覆盖
- [ ] 归档前运行 harness-comet comet verify
\`\`\`

离开 open 阶段前，运行确定性的 open 阶段检查：

\`\`\`bash
harness-comet comet hook open --change <change-id>
\`\`\``,
      design: `## Harness 设计要求

如果 \`Harness Impact\` 的 mode 是 \`full\` 或 \`maintain\`，本阶段创建的技术 Design Doc
必须包含：

\`\`\`md
## Harness Design

### Impact Mode

- Mode:
- Reason:

### Asset Decision Table

| assetType | assetId | decision | reason | contractChange | evidence |
| --------- | ------- | -------- | ------ | -------------- | -------- |

### Scenario Decision

### Fixture Decision

### Adapter Decision

### Oracle Decision
\`\`\`

规则要求：

- \`maintain\` 模式下禁止 \`create\`
- 不允许用 \`-v2\`、\`-new\`、\`-updated\` 之类命名逃避修改旧契约
- 新建 scenario 前必须说明与已有场景的业务差异

离开 design 阶段前，运行确定性的 design 阶段检查：

\`\`\`bash
harness-comet comet hook design --change <change-id>
\`\`\``,
      build: `## Harness 构建要求

当 \`Harness Impact\` 的 mode 是 \`full\` 或 \`maintain\` 时，完成 build 阶段前
必须实现 Design Doc 中声明的 Harness 资产决策：

- Scenario implementation
- Fixture implementation
- Adapter Action implementation
- Inspector implementation
- Oracle implementation
- Harness validation
- Harness scenario execution

离开 build 阶段前，运行确定性的 build 阶段检查：

\`\`\`bash
harness-comet comet hook build --change <change-id>
\`\`\``,
      verify: `## Harness 验证要求

为当前 change 运行确定性的 Harness 验证：

\`\`\`bash
harness-comet comet verify --change <change-id>
\`\`\`

如果本次变更要求的 Harness 场景失败或缺失，不得把 Comet verify 阶段视为完成。`,
      archive: `## Harness 归档要求

归档前，确认最新 Harness verification receipt 仍然匹配当前 git tree、
Harness config 和 Harness assets：

\`\`\`bash
harness-comet comet archive-check --change <change-id>
\`\`\`

如果检查失败，回到 verify/build 阶段处理，不要归档。`
    }
  };

  return `<!-- harness-comet:start phase=${phase} version=${MANAGED_PATCH_VERSION} -->

${bodyByPhase[language][phase]}

<!-- harness-comet:end phase=${phase} -->`;
}

export function applyManagedPatch(
  relativePath: string,
  current: string,
  language: CometLanguage = "en",
  mode: HarnessCometProjectMode = "runtime"
): string {
  const phase = getPatchPhase(relativePath);
  const block = buildManagedPatchBlock(phase, language, mode);
  const pattern = managedPatchPattern(phase);
  if (pattern.test(current)) {
    return current.replace(pattern, `\n\n${block}\n`);
  }
  const anchorIndex = findSupportedAnchorIndex(current);
  if (anchorIndex >= 0) {
    const before = current.slice(0, anchorIndex).replace(/\s*$/, "");
    const after = current.slice(anchorIndex).replace(/^\s*/, "");
    return `${before}\n\n${block}\n\n${after}`;
  }
  const separator = current.endsWith("\n") ? "\n" : "\n\n";
  return `${current}${separator}${block}\n`;
}

export function removeManagedPatch(relativePath: string, current: string): string {
  const phase = getPatchPhase(relativePath);
  const pattern = managedPatchPattern(phase);
  return current.replace(pattern, "\n").replace(/\n{3,}/g, "\n\n");
}

export function hasManagedPatch(relativePath: string, current: string): boolean {
  const phase = getPatchPhase(relativePath);
  return managedPatchPattern(phase).test(current);
}

export function getManagedFileContent(
  relativePath: string,
  mode: HarnessCometProjectMode = "runtime"
): string {
  if (PATCHED_SKILL_FILES.includes(relativePath as (typeof PATCHED_SKILL_FILES)[number])) {
    return buildManagedPatchBlock(getPatchPhase(relativePath), "en", mode);
  }
  switch (relativePath) {
    case "comet/SKILL.md":
    case "comet/scripts/comet-state.sh":
    case "comet/scripts/comet-guard.sh":
    case "comet/scripts/comet-archive.sh":
      return "";
    default:
      throw new Error(`Unsupported managed file: ${relativePath}`);
  }
}

export function isManagedFile(relativePath: string): boolean {
  return REQUIRED_SKILL_ROOT_FILES.includes(relativePath);
}

export function isManagedContent(content: string): boolean {
  return content.includes("harness-comet:start");
}

function managedPatchPattern(phase: PatchPhase): RegExp {
  return new RegExp(
    `\\n?<!-- harness-comet:start phase=${phase} version=(?:1|2) -->[\\s\\S]*?<!-- harness-comet:end phase=${phase} -->\\n?`,
    "m"
  );
}

function findSupportedAnchorIndex(content: string): number {
  const anchors = [
    "## Completion Criteria",
    "## Before finishing",
    "## Final checks",
    "## Exit Criteria",
    "## Completion",
    "## Final Checklist",
    "## Done"
  ];
  const lines = content.split("\n");
  let offset = 0;
  let insideFence = false;

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      insideFence = !insideFence;
    }
    const trimmed = line.trim();
    if (!insideFence && anchors.includes(trimmed)) {
      return offset;
    }
    offset += line.length + 1;
  }
  return -1;
}
