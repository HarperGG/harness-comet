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
      open: `## Harness Playwright Impact

Before leaving the open phase, update \`openspec/changes/<change-id>/design.md\` with:

\`\`\`md
## Harness Playwright Impact

- Mode: full | maintain | off
- Reason:
- Affected capabilities:
  - component: ...
    capability: ...
    behavior: ...
    risk: low | medium | high
- Existing Playwright assets:
  - path: ...
    relation: same-contract | adjacent | regression | unknown
- Preliminary decision: reuse | update | extend | create | deprecate | none
\`\`\`

Mode rules:

- \`full\`: new and existing Playwright assets may be created or updated
- \`maintain\`: modify existing declared assets only; do not create new Playwright test files
- \`off\`: only valid when the project is not already onboarded to Harness Playwright

If you believe a new Playwright test file is required while mode is \`maintain\`, stop and revise the mode to \`full\` in Design before implementation.

Run:

\`\`\`bash
harness-comet comet hook open --change <change-id>
\`\`\``,
      design: `## Harness Playwright Design

If the project uses \`mode: "playwright"\`, the design doc must include:

\`\`\`md
## Harness Playwright Design

- Mode: full | maintain | off
- Decision: reuse | update | extend | create | deprecate | none
- Decision Reason:
- Target tests:
  - path: tests/example.spec.ts | scenarioId: example-smoke | action: update | reason: ...
- Related files:
  - path: tests/support/example.ts | reason: ...
- Verification commands:
  - pnpm exec playwright test tests/example.spec.ts
\`\`\`

Mode rules:

- \`maintain\` cannot use \`Decision: create\`
- \`maintain\` may extend an existing file, but must not create a new test file
- creating a new Playwright asset requires \`Mode: full\`

Run:

\`\`\`bash
harness-comet comet hook design --change <change-id>
\`\`\``,
      build: `## Harness Playwright Build

Implement the Harness Playwright design decisions before leaving build:

- Update or create the declared target tests
- Keep key business tests tagged with \`defineHarnessScenario(...)\`
- Avoid forcing a fixed helper directory structure unless the project needs it

Build rules:

- when mode is \`maintain\`, do not create new Playwright test files or new test support assets
- only modify existing declared assets in \`maintain\`
- if a new test file appears necessary, stop and return to Design to change mode to \`full\`

Run:

\`\`\`bash
harness-comet comet hook build --change <change-id>
\`\`\``,
      verify: `## Harness Playwright Verification

Run deterministic Playwright verification for the declared target tests:

\`\`\`bash
harness-comet comet verify --change <change-id>
\`\`\`

Record:

- commandsRun
- results
- evidence
- decisionCheck

Verify rules:

- do not add a new Playwright test as a convenience shortcut during verify
- \`maintain\` must verify existing declared assets only
- if verification requires a new asset, the change must go back to Design and switch to \`full\``,
      archive: `## Harness Playwright Archive

Before archive, confirm the latest Playwright verification is still fresh:

\`\`\`bash
harness-comet comet archive-check --change <change-id>
\`\`\`

Capture:

- finalDecision
- assetsChanged
- verification
- longTermNotes`
    },
    zh: {
      open: `## Harness Playwright Impact

离开 open 阶段前，更新 \`openspec/changes/<change-id>/design.md\`，加入：

\`\`\`md
## Harness Playwright Impact

- Mode: full | maintain | off
- Reason:
- Affected capabilities:
  - component: ...
    capability: ...
    behavior: ...
    risk: low | medium | high
- Existing Playwright assets:
  - path: ...
    relation: same-contract | adjacent | regression | unknown
- Preliminary decision: reuse | update | extend | create | deprecate | none
\`\`\`

模式规则：

- \`full\`：允许新增或修改 Playwright 资产
- \`maintain\`：只能修改已声明的既有资产，禁止新建 Playwright 测试文件
- \`off\`：仅当项目尚未接入 Harness Playwright 时才允许

如果你判断 \`maintain\` 下必须新增 Playwright 测试文件，先停止实现，回到 Design 把模式改为 \`full\`。

运行：

\`\`\`bash
harness-comet comet hook open --change <change-id>
\`\`\``,
      design: `## Harness Playwright Design

如果项目使用 \`mode: "playwright"\`，设计文档必须包含：

\`\`\`md
## Harness Playwright Design

- Mode: full | maintain | off
- Decision: reuse | update | extend | create | deprecate | none
- Decision Reason:
- Target tests:
  - path: tests/example.spec.ts | scenarioId: example-smoke | action: update | reason: ...
- Related files:
  - path: tests/support/example.ts | reason: ...
- Verification commands:
  - pnpm exec playwright test tests/example.spec.ts
\`\`\`

模式规则：

- \`maintain\` 不能使用 \`Decision: create\`
- \`maintain\` 可以扩展既有文件，但不能新建测试文件
- 只有 \`Mode: full\` 才允许新增 Playwright 资产

运行：

\`\`\`bash
harness-comet comet hook design --change <change-id>
\`\`\``,
      build: `## Harness Playwright Build

离开 build 阶段前，必须实现 Harness Playwright 设计决策：

- 更新或创建声明的 target tests
- 关键业务测试保持 \`defineHarnessScenario(...)\` 元数据
- 不要预先强制项目采用固定 helper 目录结构

Build 规则：

- 当 mode 为 \`maintain\` 时，禁止新建 Playwright 测试文件和新的测试辅助资产
- \`maintain\` 只能修改既有且已声明的资产
- 如果确实需要新增测试文件，先回到 Design 把模式改为 \`full\`

运行：

\`\`\`bash
harness-comet comet hook build --change <change-id>
\`\`\``,
      verify: `## Harness Playwright Verification

为声明的 target tests 运行确定性的 Playwright 验证：

\`\`\`bash
harness-comet comet verify --change <change-id>
\`\`\`

记录：

- commandsRun
- results
- evidence
- decisionCheck

Verify 规则：

- 不要为了补验证而在 verify 阶段顺手新建 Playwright 测试
- \`maintain\` 只能验证既有且已声明的资产
- 如果验证依赖新增资产，必须回到 Design，把模式调整为 \`full\``,
      archive: `## Harness Playwright Archive

归档前，确认最新 Playwright verification 仍然有效：

\`\`\`bash
harness-comet comet archive-check --change <change-id>
\`\`\`

记录：

- finalDecision
- assetsChanged
- verification
- longTermNotes`
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

  return `<!-- harness-comet:start phase=${phase} version=1 -->

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
  const pattern = new RegExp(
    `\\n?<!-- harness-comet:start phase=${phase} version=1 -->[\\s\\S]*?<!-- harness-comet:end phase=${phase} -->\\n?`,
    "m"
  );
  if (pattern.test(current)) {
    return current.replace(pattern, `\n\n${block}\n`);
  }
  const separator = current.endsWith("\n") ? "\n" : "\n\n";
  return `${current}${separator}${block}\n`;
}

export function removeManagedPatch(relativePath: string, current: string): string {
  const phase = getPatchPhase(relativePath);
  const pattern = new RegExp(
    `\\n?<!-- harness-comet:start phase=${phase} version=1 -->[\\s\\S]*?<!-- harness-comet:end phase=${phase} -->\\n?`,
    "m"
  );
  return current.replace(pattern, "\n").replace(/\n{3,}/g, "\n\n");
}

export function hasManagedPatch(relativePath: string, current: string): boolean {
  const phase = getPatchPhase(relativePath);
  return current.includes(`<!-- harness-comet:start phase=${phase} version=1 -->`);
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
