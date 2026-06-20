import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const managedRoot = path.join(
  root,
  "packages/comet-adapter/assets/comet-skills/playwright"
);
const snapshotRoot = path.join(root, "test/fixtures/comet-upstream");

const phases = ["open", "design", "build", "verify", "archive"];
const languages = {
  en: "assets/skills",
  zh: "assets/skills-zh"
};

const blocks = {
  en: {
    openBeforeReview: `<!-- HARNESS-COMET:BEGIN open-impact -->
### Harness/Playwright Impact Analysis

If \`harness-comet.config.ts\` resolves to \`mode: "playwright"\`:

1. Immediately load \`playwright-impact-analysis\` in \`comet\` context.
2. Analyze the confirmed requirements, OpenSpec artifacts, relevant production code, existing \`*.spec.*\` files, fixtures, Page Objects, test data, and support helpers.
3. Do not modify Playwright assets during Open.
4. Write the normalized result to \`proposal.md\` under:

   \`\`\`md
   ## Playwright Impact Analysis
   \`\`\`

The section must identify changed behavior, affected tests, coverage gaps, exact evidence paths, recommended target operations, confidence, and unresolved uncertainty.

For non-Playwright mode, skip this extension and continue the upstream workflow unchanged.
<!-- HARNESS-COMET:END open-impact -->`,
    openBeforeExit: `<!-- HARNESS-COMET:BEGIN open-decision-and-gate -->
### Harness/Playwright Authoring Decision and Open Gate

After the upstream user review is confirmed, if the project is in Playwright mode:

1. Immediately load \`playwright-authoring-decision\` in \`comet\` context.
2. Let the user accept recommendations, customize target-level operations, skip Playwright authoring, or request adjustments.
3. Persist the normalized decision in \`proposal.md\` under \`## Playwright Authoring Decision\`.
4. Use only target-level operations: \`verify\`, \`update\`, \`create\`, \`retire\`, or \`ignore\`.
5. When authoring is enabled, add explicit Playwright planning, implementation, and verification tasks to \`tasks.md\`.
6. Run before the upstream Open guard:

   \`\`\`bash
   pnpm exec harness-comet comet hook open --change <change-name>
   \`\`\`

If the hook fails, fix the reported artifacts and rerun it. Do not edit \`.harness-comet/manifest.json\` to simulate success.
<!-- HARNESS-COMET:END open-decision-and-gate -->`,
    designBeforeDoc: `<!-- HARNESS-COMET:BEGIN design-authoring-plan -->
### Harness/Playwright Authoring Plan

If \`harness-comet.config.ts\` resolves to \`mode: "playwright"\`:

1. If \`proposal.md\` contains an enabled \`Playwright Authoring Decision\`, immediately load \`playwright-authoring-plan\` in \`comet\` context.
2. Use the original requirement, \`Playwright Impact Analysis\`, confirmed target decisions, confirmed technical approach, OpenSpec artifacts, handoff package, and repository evidence.
3. Do not introduce targets absent from the confirmed decision.
4. Produce a target-by-target plan with requirement-to-assertion mapping, boundary classification, execution route, production sources, exact target operations, files, fixtures, test data, Page Objects, network strategy, evidence paths, and verification commands.
5. Reconcile conflicts with the confirmed design and Spec Patches by returning to brainstorming and user confirmation; never change scope silently.
6. If authoring was skipped, create an explicit no-op plan.
7. When the upstream Design Doc is created, include the plan under \`## Playwright Authoring Plan\`.

Do not modify Playwright assets during Design.
<!-- HARNESS-COMET:END design-authoring-plan -->`,
    designBeforeState: `<!-- HARNESS-COMET:BEGIN design-gate -->
### Harness/Playwright Design Gate

In upstream Step 3, after recording \`design_doc\` and regenerating handoff when needed, but immediately before the native Design guard, run:

\`\`\`bash
pnpm exec harness-comet comet hook design --change <change-name>
\`\`\`

If it fails, fix the Design Doc, Playwright plan, OpenSpec artifacts, or decision consistency and rerun it. Do not edit \`.harness-comet/manifest.json\` to simulate success.
<!-- HARNESS-COMET:END design-gate -->`,
    buildAfterPlan: `<!-- HARNESS-COMET:BEGIN build-plan-extension -->
### Harness/Playwright Plan Extension

When the Design Doc contains \`## Playwright Authoring Plan\`, the implementation plan must preserve each approved target path and operation exactly:

- \`verify\`: add verification work without planned edits
- \`update\`: edit only approved test and support assets
- \`create\`: create only approved paths
- \`retire\`: remove the approved target and references
- \`ignore\`: create no implementation task

Do not introduce undeclared targets.
<!-- HARNESS-COMET:END build-plan-extension -->`,
    buildBeforeDebug: `<!-- HARNESS-COMET:BEGIN build-authoring-execution -->
### 3a. Harness/Playwright Authoring Execution

Whenever execution reaches a Playwright authoring task:

1. Immediately load \`playwright-authoring-build\` in \`comet\` context.
2. Treat the approved Design Doc plan as the exact scope boundary.
3. Apply only declared target operations and paths.
4. Test the real application implementation. Mock dependencies, never the feature itself.
5. Preserve approved assertions, \`@harness\` tags, fixtures, test data, Page Objects, network strategy, and evidence requirements.
6. Do not create standalone authoring-session documents.
7. Do not introduce undeclared targets.
8. Check off the task only after target-specific acceptance and verification pass.

For subagent-driven development, every implementer or fix agent assigned a Playwright task must load \`playwright-authoring-build\` before editing Playwright assets.
<!-- HARNESS-COMET:END build-authoring-execution -->`,
    buildBeforeExit: `<!-- HARNESS-COMET:BEGIN build-authoring-verification -->
### Harness/Playwright Authoring Verification and Build Gate

After implementation and required code review, but before the upstream Build guard:

1. Immediately load \`playwright-authoring-verify\` in \`comet\` context.
2. Validate every declared runnable target and confirm paths and operations match the approved decision and plan.
3. Confirm tags, requirement assertions, real-application boundary, fixtures, mocks, and evidence.
4. Confirm no synthetic replacement application or undeclared target was introduced.
5. Confirm \`verify\` and \`ignore\` targets were not edited without a newly confirmed decision.
6. Record results in the Design Doc under \`## Playwright Authoring Verification\`.
7. Run:

   \`\`\`bash
   pnpm exec harness-comet comet hook build --change <change-name>
   \`\`\`

If implementation is defective, return to the relevant Build task without broadening scope. If target scope must change, return through Design and obtain a revised user decision. Do not edit \`.harness-comet/manifest.json\` to simulate success.
<!-- HARNESS-COMET:END build-authoring-verification -->`,
    verifyBeforeFinishing: `<!-- HARNESS-COMET:BEGIN verify-playwright -->
### Harness/Playwright Change Verification

After the upstream light or full verification passes, and before branch finishing, if the project is in Playwright mode and the change has a Playwright decision or plan, run:

\`\`\`bash
pnpm exec harness-comet comet verify --change <change-name>
\`\`\`

The command must execute only declared runnable targets, exclude ignored and retired targets, protect unchanged \`verify\` targets, require Harness reporter output, validate declared-target coverage, and write results, report, receipt, fingerprints, and evidence metadata. When no runnable target applies, it must produce an explicit not-applicable receipt.

Do not create, update, retire, redesign, or repair Playwright assets during Verify. On failure, report exact targets and evidence and enter the upstream verification-failure decision flow. Return to Build only after the user chooses to fix.
<!-- HARNESS-COMET:END verify-playwright -->`,
    archiveBeforeConfirmation: `<!-- HARNESS-COMET:BEGIN archive-preflight -->
### Harness/Playwright Archive Preflight

Before the upstream final archive confirmation, if the project is in Playwright mode and the change has a Playwright decision, plan, or Harness receipt, run:

\`\`\`bash
pnpm exec harness-comet comet archive-check --change <change-name>
\`\`\`

Confirm that the verification receipt is passing or explicitly not applicable; receipt, results, report, and fingerprints are fresh; declared targets and operations remain consistent; required evidence paths exist; ignored and retired targets are consistent; incident bindings are valid; and no Playwright asset changed after verification without a newer receipt.

If preflight fails, do not present the change as archive-ready. Offer upstream re-verification or leave the change in Archive state. Do not edit manifests, receipts, or fingerprints to simulate freshness.
<!-- HARNESS-COMET:END archive-preflight -->`
  },
  zh: {
    openBeforeReview: `<!-- HARNESS-COMET:BEGIN open-impact -->
### Harness/Playwright 影响分析

如果 \`harness-comet.config.ts\` 解析为 \`mode: "playwright"\`：

1. 立即在 \`comet\` 上下文加载 \`playwright-impact-analysis\`。
2. 分析已确认需求、OpenSpec 产物、相关生产代码、现有 \`*.spec.*\`、fixture、Page Object、测试数据和支持工具。
3. Open 阶段不得修改 Playwright 资产。
4. 将规范化结果写入 \`proposal.md\` 的 \`## Playwright Impact Analysis\`。

该章节必须识别行为变化、受影响测试、覆盖缺口、精确证据路径、建议目标操作、置信度和未解决不确定性。

非 Playwright 模式跳过此扩展，并原样继续上游流程。
<!-- HARNESS-COMET:END open-impact -->`,
    openBeforeExit: `<!-- HARNESS-COMET:BEGIN open-decision-and-gate -->
### Harness/Playwright 编写决策与 Open Gate

上游用户审视确认后，如果项目为 Playwright 模式：

1. 立即在 \`comet\` 上下文加载 \`playwright-authoring-decision\`。
2. 允许用户接受建议、自定义目标级操作、跳过 Playwright 编写或请求调整。
3. 将规范化决策写入 \`proposal.md\` 的 \`## Playwright Authoring Decision\`。
4. 只使用 \`verify\`、\`update\`、\`create\`、\`retire\`、\`ignore\` 目标级操作。
5. 启用编写时，在 \`tasks.md\` 添加明确的 Playwright 规划、实施和验证任务。
6. 在上游 Open guard 前运行：

   \`\`\`bash
   pnpm exec harness-comet comet hook open --change <change-name>
   \`\`\`

hook 失败时修复报告的产物并重试。不得编辑 \`.harness-comet/manifest.json\` 伪造成功。
<!-- HARNESS-COMET:END open-decision-and-gate -->`,
    designBeforeDoc: `<!-- HARNESS-COMET:BEGIN design-authoring-plan -->
### Harness/Playwright 编写规划

如果 \`harness-comet.config.ts\` 解析为 \`mode: "playwright"\`：

1. 当 \`proposal.md\` 含已启用的 \`Playwright Authoring Decision\` 时，立即在 \`comet\` 上下文加载 \`playwright-authoring-plan\`。
2. 使用原始需求、\`Playwright Impact Analysis\`、已确认目标决策、已确认技术方案、OpenSpec 产物、交接包和仓库证据。
3. 不得引入已确认决策之外的目标。
4. 逐目标生成需求到断言映射、边界分类、执行路径、生产代码来源、目标操作、文件、fixture、测试数据、Page Object、网络策略、证据路径和验证命令。
5. 与已确认设计或 Spec Patch 冲突时，回到 brainstorming 和用户确认，不得静默改变范围。
6. 跳过编写时生成明确 no-op 规划。
7. 创建上游 Design Doc 时，在 \`## Playwright Authoring Plan\` 下写入规划。

Design 阶段不得修改 Playwright 资产。
<!-- HARNESS-COMET:END design-authoring-plan -->`,
    designBeforeState: `<!-- HARNESS-COMET:BEGIN design-gate -->
### Harness/Playwright Design Gate

在上游 Step 3 中，记录 \`design_doc\` 并按需重新生成 handoff 后、执行原生 Design guard 前运行：

\`\`\`bash
pnpm exec harness-comet comet hook design --change <change-name>
\`\`\`

失败时修复 Design Doc、Playwright 规划、OpenSpec 产物或决策一致性并重试。不得编辑 \`.harness-comet/manifest.json\` 伪造成功。
<!-- HARNESS-COMET:END design-gate -->`,
    buildAfterPlan: `<!-- HARNESS-COMET:BEGIN build-plan-extension -->
### Harness/Playwright 计划扩展

Design Doc 包含 \`## Playwright Authoring Plan\` 时，实施计划必须精确保留每个已批准目标路径和操作：

- \`verify\`：只添加验证工作，不计划修改
- \`update\`：只编辑已批准测试和支持资产
- \`create\`：只创建已批准路径
- \`retire\`：移除已批准目标及引用
- \`ignore\`：不创建实施任务

不得引入未声明目标。
<!-- HARNESS-COMET:END build-plan-extension -->`,
    buildBeforeDebug: `<!-- HARNESS-COMET:BEGIN build-authoring-execution -->
### 3a. Harness/Playwright 编写实施

执行到 Playwright 编写任务时：

1. 立即在 \`comet\` 上下文加载 \`playwright-authoring-build\`。
2. 将已批准 Design Doc 规划作为精确范围边界。
3. 只实施已声明目标操作和路径。
4. 测试真实应用实现；可以 mock 依赖，但不得 mock 功能本身。
5. 保留已批准断言、\`@harness\` 标签、fixture、测试数据、Page Object、网络策略和证据要求。
6. 不创建独立 authoring session 文档。
7. 不引入未声明目标。
8. 目标级验收和验证通过后才勾选任务。

subagent 模式下，每个负责 Playwright 任务的 implementer 或 fix agent 必须在编辑资产前加载 \`playwright-authoring-build\`。
<!-- HARNESS-COMET:END build-authoring-execution -->`,
    buildBeforeExit: `<!-- HARNESS-COMET:BEGIN build-authoring-verification -->
### Harness/Playwright 编写验证与 Build Gate

实施和必要代码审查完成后、执行上游 Build guard 前：

1. 立即在 \`comet\` 上下文加载 \`playwright-authoring-verify\`。
2. 验证每个已声明可运行目标，确认路径和操作与已批准决策及规划一致。
3. 确认标签、需求断言、真实应用边界、fixture、mock 和证据。
4. 确认没有合成替代应用或未声明目标。
5. 确认 \`verify\` 和 \`ignore\` 目标未在无新确认决策时被编辑。
6. 将结果写入 Design Doc 的 \`## Playwright Authoring Verification\`。
7. 运行：

   \`\`\`bash
   pnpm exec harness-comet comet hook build --change <change-name>
   \`\`\`

实施有缺陷时回到对应 Build 任务且不得扩大范围。目标范围必须变化时回到 Design 并获得新决策。不得编辑 \`.harness-comet/manifest.json\` 伪造成功。
<!-- HARNESS-COMET:END build-authoring-verification -->`,
    verifyBeforeFinishing: `<!-- HARNESS-COMET:BEGIN verify-playwright -->
### Harness/Playwright Change 验证

上游 light 或 full 验证通过后、分支收尾前，如果项目为 Playwright 模式且 change 有 Playwright 决策或规划，运行：

\`\`\`bash
pnpm exec harness-comet comet verify --change <change-name>
\`\`\`

命令必须只执行已声明可运行目标，排除 ignored 和 retired 目标，保护未变更的 \`verify\` 目标，要求 Harness reporter 输出，校验目标覆盖，并写入 results、report、receipt、fingerprints 和 evidence 元数据。无可运行目标时必须生成明确 not-applicable receipt。

Verify 阶段不得创建、更新、退役、重设计或修复 Playwright 资产。失败时报告精确目标和证据，并进入上游验证失败决策流程。只有用户选择修复后才回到 Build。
<!-- HARNESS-COMET:END verify-playwright -->`,
    archiveBeforeConfirmation: `<!-- HARNESS-COMET:BEGIN archive-preflight -->
### Harness/Playwright 归档预检

上游最终归档确认前，如果项目为 Playwright 模式且 change 有 Playwright 决策、规划或 Harness receipt，运行：

\`\`\`bash
pnpm exec harness-comet comet archive-check --change <change-name>
\`\`\`

确认验证 receipt 为通过或明确 not-applicable；receipt、results、report 和 fingerprints 仍然新鲜；目标和操作一致；证据路径存在；ignored 和 retired 目标一致；incident 绑定有效；验证后没有 Playwright 资产变化却缺少更新后的 receipt。

预检失败时不得把 change 展示为可归档。按上游流程重新验证或保持 Archive 状态。不得编辑 manifest、receipt 或 fingerprints 伪造新鲜度。
<!-- HARNESS-COMET:END archive-preflight -->`
  }
};

function insertBefore(source, anchor, block, label) {
  const index = source.indexOf(anchor);
  if (index === -1) throw new Error(`Missing anchor for ${label}: ${anchor}`);
  if (source.indexOf(anchor, index + anchor.length) !== -1) {
    throw new Error(`Anchor is not unique for ${label}: ${anchor}`);
  }
  return `${source.slice(0, index)}${block}\n\n${source.slice(index)}`;
}

function overlay(source, language, phase) {
  const b = blocks[language];
  if (phase === "open") {
    const review = language === "en"
      ? "### 5. User Review and Confirmation (Blocking Point)"
      : "### 5. 用户审视确认（阻塞点）";
    let result = insertBefore(source, review, b.openBeforeReview, `${language}/open review`);
    result = insertBefore(result, "## Exit Conditions", b.openBeforeExit, `${language}/open exit`);
    return result;
  }
  if (phase === "design") {
    const doc = language === "en" ? "### 2. Create Design Doc" : "### 2. 创建 Design Doc";
    const state = language === "en" ? "### 3. Update Comet State" : "### 3. 更新 Comet 状态";
    let result = insertBefore(source, doc, b.designBeforeDoc, `${language}/design doc`);
    result = insertBefore(result, state, b.designBeforeState, `${language}/design state`);
    return result;
  }
  if (phase === "build") {
    const step2 = language === "en"
      ? "### 2. Update Plan Status and Provide Plan-Ready Pause Point"
      : "### 2. 更新计划状态并提供 Plan-Ready 暂停点";
    const debug = language === "en"
      ? "### 3b. In-Execution Debugging (Debug Gate)"
      : "### 3b. 执行中异常调试（Debug Gate）";
    let result = insertBefore(source, step2, b.buildAfterPlan, `${language}/build plan`);
    result = insertBefore(result, debug, b.buildBeforeDebug, `${language}/build debug`);
    result = insertBefore(result, "## Exit Conditions", b.buildBeforeExit, `${language}/build exit`);
    return result;
  }
  if (phase === "verify") {
    const finishing = language === "en"
      ? "### 3. Finishing (Superpowers)"
      : "### 3. 收尾（Superpowers）";
    return insertBefore(source, finishing, b.verifyBeforeFinishing, `${language}/verify finishing`);
  }
  if (phase === "archive") {
    const confirmation = language === "en"
      ? "### 1. Final Archive Confirmation (Blocking Point)"
      : "### 1. 归档前最终确认（阻塞点）";
    return insertBefore(source, confirmation, b.archiveBeforeConfirmation, `${language}/archive confirmation`);
  }
  throw new Error(`Unknown phase: ${phase}`);
}

for (const [language, upstreamDir] of Object.entries(languages)) {
  for (const phase of phases) {
    const url = `https://raw.githubusercontent.com/rpamis/comet/master/${upstreamDir}/comet-${phase}/SKILL.md`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    const upstream = (await response.text()).replace(/\r\n/g, "\n");
    const managed = overlay(upstream, language, phase);

    const snapshotPath = path.join(snapshotRoot, language, `comet-${phase}`, "SKILL.md");
    const managedPath = path.join(managedRoot, language, `comet-${phase}`, "SKILL.md");
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await mkdir(path.dirname(managedPath), { recursive: true });
    await writeFile(snapshotPath, upstream, "utf8");
    await writeFile(managedPath, managed, "utf8");
  }
}

for (const oldTest of [
  "test/comet-open-managed-assets.test.ts",
  "test/comet-design-managed-assets.test.ts",
  "test/comet-build-managed-assets.test.ts",
  "test/comet-verify-managed-assets.test.ts",
  "test/comet-archive-managed-assets.test.ts"
]) {
  await rm(path.join(root, oldTest), { force: true });
}

console.log("Synced verbatim Comet upstream snapshots and generated Harness overlays.");
