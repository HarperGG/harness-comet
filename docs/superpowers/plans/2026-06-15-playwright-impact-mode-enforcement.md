# Playwright Impact Mode Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `impact mode` in Playwright mode enforceable so `full`, `maintain`, and `off` control what test assets an agent may create or modify during Comet Open / Design / Build / Verify.

**Architecture:** Keep the existing Playwright-mode config, docs, and hook flow, but tighten it in three layers: stronger mode semantics in parsed design docs, mode-aware hook validation, and file-level enforcement that checks actual workspace changes instead of trusting prompt intent. `maintain` becomes “modify existing assets only,” `full` becomes “new and existing assets allowed,” and `off` becomes “no Playwright asset work unless the project is not onboarded.”

**Tech Stack:** TypeScript, ESM, pnpm workspace, Vitest, Commander, existing `@harness-comet/core`, `@harness-comet/cli`, and `@harness-comet/comet-adapter`.

---

## Scope And Product Decisions

- This plan only changes **Playwright mode** governance.
- Runtime mode (`mode: "runtime"`) behavior must remain unchanged.
- `impact mode` is a **change-level decision**, not a project-level permanent setting.
- `mode` may be set in Open and revised in Design, but must be treated as frozen by Build and Verify.
- `maintain` must explicitly forbid creating new Playwright test assets.
- “Extend” in Playwright mode means extending an **existing test file** or other **existing asset**, not creating a new file.
- File-level enforcement is required. Prompt guidance alone is not sufficient.

## File Map

Create:

- `packages/comet-adapter/src/playwright-impact-policy.ts`  
  Central policy module for allowed decisions, file classifications, and enforcement helpers.

- `packages/comet-adapter/src/playwright-impact-policy.test.ts`  
  Unit tests for decision normalization and file-level policy classification.

- `test/comet-playwright-impact-mode.integration.test.ts`  
  Integration tests that prove `maintain` blocks new Playwright assets, `full` allows them, and `off` blocks onboarded projects.

Modify:

- `packages/comet-adapter/src/change.ts`  
  Tighten Playwright Impact / Design parsing and add explicit decision semantics for `testAssetDecision`, `targetTests`, and related files.

- `packages/comet-adapter/src/hooks.ts`  
  Enforce mode-specific design rules and add file-level Build / Verify checks.

- `packages/comet-adapter/src/verify.ts`  
  Reuse the new policy layer so Verify catches unauthorized asset creation too.

- `packages/comet-adapter/src/assets.ts`  
  Strengthen Playwright-mode Comet skill patches so `maintain` is phrased as a hard prohibition, not a soft preference.

- `test/comet-playwright-hooks.integration.test.ts`  
  Update existing hook tests to reflect the tighter protocol.

- `docs/superpowers/specs/` or current Playwright-mode design docs if this repo keeps one authoritative design artifact  
  Add or update the human-facing protocol wording after implementation if needed.

---

### Task 1: Define Playwright Impact Policy As Code

**Files:**
- Create: `packages/comet-adapter/src/playwright-impact-policy.ts`
- Create: `packages/comet-adapter/src/playwright-impact-policy.test.ts`
- Test: `packages/comet-adapter/src/playwright-impact-policy.test.ts`

- [ ] **Step 1: Write failing policy tests**

Add tests that lock the policy semantics:

```ts
import { describe, expect, it } from "vitest";
import {
  PLAYWRIGHT_CREATE_DECISIONS,
  classifyPlaywrightAssetPath,
  isDecisionAllowedForMode
} from "./playwright-impact-policy.js";

describe("playwright impact policy", () => {
  it("allows create only for full mode", () => {
    expect(isDecisionAllowedForMode("full", "create")).toBe(true);
    expect(isDecisionAllowedForMode("maintain", "create")).toBe(false);
    expect(isDecisionAllowedForMode("off", "create")).toBe(false);
  });

  it("treats extend as allowed in maintain mode", () => {
    expect(isDecisionAllowedForMode("maintain", "extend")).toBe(true);
  });

  it("classifies spec files as playwright test assets", () => {
    expect(classifyPlaywrightAssetPath("tests/example.spec.ts")).toEqual({
      kind: "test-spec",
      managed: true
    });
  });

  it("classifies non-test docs as unmanaged", () => {
    expect(classifyPlaywrightAssetPath("docs/testing/README.md")).toEqual({
      kind: "other",
      managed: false
    });
  });
});
```

- [ ] **Step 2: Run the new unit test and confirm failure**

Run:

```bash
pnpm exec vitest run packages/comet-adapter/src/playwright-impact-policy.test.ts
```

Expected: FAIL because the new module does not exist yet.

- [ ] **Step 3: Implement the policy module**

Create `packages/comet-adapter/src/playwright-impact-policy.ts` with focused exports:

```ts
export const PLAYWRIGHT_DECISIONS = ["reuse", "update", "extend", "create", "none"] as const;
export type PlaywrightImpactDecision = (typeof PLAYWRIGHT_DECISIONS)[number];

export const PLAYWRIGHT_CREATE_DECISIONS = new Set<PlaywrightImpactDecision>(["create"]);

export function isDecisionAllowedForMode(
  mode: "full" | "maintain" | "off",
  decision: PlaywrightImpactDecision
): boolean {
  if (mode === "full") return decision !== "none" || true;
  if (mode === "maintain") return decision !== "create";
  return decision === "none";
}

export function classifyPlaywrightAssetPath(filePath: string): {
  kind: "test-spec" | "test-support" | "config" | "other";
  managed: boolean;
} {
  if (/\.spec\.[cm]?[jt]sx?$/.test(filePath)) {
    return { kind: "test-spec", managed: true };
  }
  if (
    /^tests\//.test(filePath) &&
    !/\.spec\.[cm]?[jt]sx?$/.test(filePath)
  ) {
    return { kind: "test-support", managed: true };
  }
  if (filePath === "playwright.config.ts") {
    return { kind: "config", managed: true };
  }
  return { kind: "other", managed: false };
}
```

- [ ] **Step 4: Re-run the unit test**

Run:

```bash
pnpm exec vitest run packages/comet-adapter/src/playwright-impact-policy.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/comet-adapter/src/playwright-impact-policy.ts packages/comet-adapter/src/playwright-impact-policy.test.ts
git commit -m "feat: add playwright impact policy helpers"
```

### Task 2: Tighten Playwright Change Document Parsing

**Files:**
- Modify: `packages/comet-adapter/src/change.ts`
- Test: `test/comet-playwright-hooks.integration.test.ts`

- [ ] **Step 1: Add failing integration expectations for explicit decision semantics**

Update the Playwright change fixture in `test/comet-playwright-hooks.integration.test.ts` so the design doc includes:

```md
## Harness Playwright Design

- Mode: maintain
- Decision: update
- Decision Reason: same contract with a small UI adjustment
- Target tests:
  - path: tests/example.spec.ts | scenarioId: example-smoke | action: update | reason: same contract
- Related files:
  - path: playwright.config.ts | reason: config remains unchanged
- Verification commands:
  - pnpm exec playwright test tests/example.spec.ts
```

Add a negative case that uses:

```md
- Decision: create
```

under `mode: maintain`, and expect the hook to fail.

- [ ] **Step 2: Run the integration test and confirm failure**

Run:

```bash
pnpm exec vitest run test/comet-playwright-hooks.integration.test.ts
```

Expected: FAIL because maintain/create is not fully enforced yet.

- [ ] **Step 3: Update Playwright parsing records**

In `packages/comet-adapter/src/change.ts`, make sure `PlaywrightHarnessDesignRecord` carries enough structure for enforcement:

```ts
export interface PlaywrightHarnessDesignRecord {
  mode: HarnessImpactMode;
  decision: "reuse" | "update" | "extend" | "create" | "none";
  decisionReason: string;
  targetTests: PlaywrightTargetTestRecord[];
  relatedFiles: PlaywrightRelatedFileRecord[];
  verificationCommands: string[];
}
```

Normalize parsed values so later hooks do not need to guess casing, whitespace, or synonyms.

- [ ] **Step 4: Add a helper for “create-like” intent**

Add an exported helper in `change.ts` or move it into the new policy module:

```ts
export function designDeclaresPlaywrightCreation(
  design: PlaywrightHarnessDesignRecord
): boolean {
  return design.decision === "create" ||
    design.targetTests.some((test) => test.action === "create");
}
```

- [ ] **Step 5: Re-run the integration test**

Run:

```bash
pnpm exec vitest run test/comet-playwright-hooks.integration.test.ts
```

Expected: still FAIL or partially PASS until hooks are updated in the next task.

- [ ] **Step 6: Commit**

```bash
git add packages/comet-adapter/src/change.ts test/comet-playwright-hooks.integration.test.ts
git commit -m "refactor: normalize playwright impact design parsing"
```

### Task 3: Enforce Mode Rules In Open And Design Hooks

**Files:**
- Modify: `packages/comet-adapter/src/hooks.ts`
- Modify: `packages/comet-adapter/src/change.ts`
- Test: `test/comet-playwright-hooks.integration.test.ts`

- [ ] **Step 1: Add failing tests for mode/decision combinations**

Add explicit hook test cases:

```ts
it("design hook rejects create decision in maintain mode", async () => {
  // create Playwright project + change doc
  // set Mode: maintain
  // set Decision: create
  // expect exitCode !== 0
  // expect stderr/stdout to contain MAINTAIN_CREATE_INVALID
});

it("design hook rejects off mode for onboarded Playwright project", async () => {
  // set Mode: off in a project that already has harness-comet.config.ts and tests/example.spec.ts
  // expect failure
});
```

- [ ] **Step 2: Run the hook integration suite and confirm failure**

Run:

```bash
pnpm exec vitest run test/comet-playwright-hooks.integration.test.ts
```

Expected: FAIL on the new negative cases.

- [ ] **Step 3: Implement explicit Open-hook rules**

In `runCometPlaywrightOpenHook(...)`, enforce:

```ts
if (impact.mode === "maintain" && impact.preliminaryDecision === "create") {
  throw new HarnessError({
    code: "COMET_OPEN_PLAYWRIGHT_MAINTAIN_CREATE_INVALID",
    category: "config",
    message: `Harness Playwright Impact mode maintain cannot declare create for ${change}`,
    path: designPath
  });
}

if (impact.mode === "off" && (await projectHasHarnessAssets(projectRoot))) {
  throw new HarnessError({
    code: "COMET_OPEN_PLAYWRIGHT_OFF_INVALID",
    category: "config",
    message: `Harness Playwright Impact mode off is not allowed for an onboarded project: ${change}`,
    path: designPath
  });
}
```

- [ ] **Step 4: Implement explicit Design-hook rules**

In `runCometPlaywrightDesignHook(...)`, enforce:

```ts
if (!isDecisionAllowedForMode(design.mode, design.decision)) {
  throw new HarnessError({
    code: "COMET_DESIGN_PLAYWRIGHT_DECISION_INVALID",
    category: "config",
    message: `Harness Playwright Design decision ${design.decision} is not allowed in mode ${design.mode} for ${change}`,
    path: designPath
  });
}

if (design.mode === "maintain" && designDeclaresPlaywrightCreation(design)) {
  throw new HarnessError({
    code: "COMET_DESIGN_PLAYWRIGHT_MAINTAIN_CREATE_INVALID",
    category: "config",
    message: `Harness Playwright Design mode maintain cannot create new test assets for ${change}`,
    path: designPath
  });
}

if (design.mode === "off" && design.decision !== "none") {
  throw new HarnessError({
    code: "COMET_DESIGN_PLAYWRIGHT_OFF_INVALID",
    category: "config",
    message: `Harness Playwright Design mode off must use decision none for ${change}`,
    path: designPath
  });
}
```

- [ ] **Step 5: Re-run the hook integration suite**

Run:

```bash
pnpm exec vitest run test/comet-playwright-hooks.integration.test.ts
```

Expected: PASS for mode/decision document-level enforcement.

- [ ] **Step 6: Commit**

```bash
git add packages/comet-adapter/src/hooks.ts packages/comet-adapter/src/change.ts test/comet-playwright-hooks.integration.test.ts
git commit -m "feat: enforce playwright impact modes in open and design hooks"
```

### Task 4: Enforce File-Level Restrictions In Build Hook

**Files:**
- Modify: `packages/comet-adapter/src/hooks.ts`
- Create: `test/comet-playwright-impact-mode.integration.test.ts`
- Test: `test/comet-playwright-impact-mode.integration.test.ts`

- [ ] **Step 1: Add a failing integration test for maintain creating a new spec**

Create an integration test that:

1. Creates a temp Playwright project with `tests/example.spec.ts`
2. Creates a change with:

```md
## Harness Playwright Impact
- Mode: maintain
...

## Harness Playwright Design
- Mode: maintain
- Decision: update
...
```

3. Creates a **new** file:

```text
tests/new-flow.spec.ts
```

4. Runs:

```bash
pnpm --root <repo> comet hook build --change demo-change
```

5. Expects failure with a code/message mentioning unauthorized Playwright asset creation in maintain mode.

- [ ] **Step 2: Add a passing integration test for full creating a new spec**

In the same test file, add:

```ts
it("build hook allows new playwright assets in full mode", async () => {
  // same setup, but Mode: full and Decision: create
  // add tests/new-flow.spec.ts
  // expect success
});
```

- [ ] **Step 3: Run the new integration test and confirm failure**

Run:

```bash
pnpm exec vitest run test/comet-playwright-impact-mode.integration.test.ts
```

Expected: FAIL because Build is not checking actual file additions yet.

- [ ] **Step 4: Implement file discovery for changed Playwright assets**

In `hooks.ts`, add a helper that computes newly added managed files from the current workspace relative to the design doc:

```ts
async function detectNewPlaywrightManagedFiles(projectRoot: string): Promise<string[]> {
  // Walk tests/ and known managed config files.
  // Compare current files to the target tests + related files declared in design.
  // For this phase, a pragmatic rule is enough:
  // new managed files are files in tests/** or playwright.config.ts
  // that are present in the working tree and were not listed as existing assets in Open impact.
}
```

Use the current design data:

- `impact.existingPlaywrightAssets`
- `design.targetTests`
- `design.relatedFiles`

to decide whether a file is:
- existing and modifiable
- newly created and therefore forbidden in `maintain`

- [ ] **Step 5: Enforce the maintain/full/off file policy in Build**

Inside `runCometPlaywrightBuildHook(...)`, after document validation and project validation:

```ts
const unauthorizedCreates = await findUnauthorizedPlaywrightCreates(projectRoot, impact, design);

if (design.mode === "maintain" && unauthorizedCreates.length > 0) {
  throw new HarnessError({
    code: "COMET_BUILD_PLAYWRIGHT_MAINTAIN_CREATE_INVALID",
    category: "config",
    message: `Maintain mode cannot create new Playwright assets: ${unauthorizedCreates.join(", ")}`,
    path: designPath
  });
}

if (design.mode === "off" && unauthorizedCreates.length > 0) {
  throw new HarnessError({
    code: "COMET_BUILD_PLAYWRIGHT_OFF_INVALID",
    category: "config",
    message: `Off mode cannot create Playwright assets: ${unauthorizedCreates.join(", ")}`,
    path: designPath
  });
}
```

- [ ] **Step 6: Re-run the new Build integration test**

Run:

```bash
pnpm exec vitest run test/comet-playwright-impact-mode.integration.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/comet-adapter/src/hooks.ts test/comet-playwright-impact-mode.integration.test.ts
git commit -m "feat: block unauthorized playwright asset creation in build hook"
```

### Task 5: Reuse The Same Policy In Verify

**Files:**
- Modify: `packages/comet-adapter/src/verify.ts`
- Modify: `test/comet-verify.integration.test.ts`
- Test: `test/comet-verify.integration.test.ts`

- [ ] **Step 1: Add a failing verify test for maintain mode drift**

Add a Playwright-mode verify integration case where:

- the change declares `mode: maintain`
- a new spec file exists in the project
- Build was not run first

Verify should fail rather than executing and blessing the new file.

- [ ] **Step 2: Run verify integration tests and confirm failure**

Run:

```bash
pnpm exec vitest run test/comet-verify.integration.test.ts
```

Expected: FAIL because Verify does not yet reuse the file-level policy.

- [ ] **Step 3: Import and apply the Build-time policy in Verify**

In `packages/comet-adapter/src/verify.ts`, before running Playwright mode verification:

```ts
const policy = await evaluatePlaywrightImpactPolicy(projectRoot, change);
if (!policy.ok) {
  throw policy.error;
}
```

The same helper should be reusable from both Build and Verify so there is one source of truth.

- [ ] **Step 4: Re-run verify integration tests**

Run:

```bash
pnpm exec vitest run test/comet-verify.integration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/comet-adapter/src/verify.ts test/comet-verify.integration.test.ts
git commit -m "feat: enforce playwright impact policy during verify"
```

### Task 6: Strengthen Comet Skill Patch Guidance

**Files:**
- Modify: `packages/comet-adapter/src/assets.ts`
- Test: `test/comet-install.integration.test.ts`

- [ ] **Step 1: Add failing install expectations for stronger maintain wording**

Update `test/comet-install.integration.test.ts` to assert that Playwright-mode skill patches contain hard wording like:

```txt
When mode is maintain, do not create new Playwright test files.
Only modify existing declared assets.
If you believe a new test file is required, stop and revise the mode to full in Design before implementation.
```

- [ ] **Step 2: Run the install integration test and confirm failure**

Run:

```bash
pnpm exec vitest run test/comet-install.integration.test.ts
```

Expected: FAIL because the current injected guidance is softer.

- [ ] **Step 3: Update the Playwright patch blocks**

In `packages/comet-adapter/src/assets.ts`, revise the Playwright-mode patch text for:

- `open`
- `design`
- `build`
- `verify`

so that:

- Open says `maintain` is “modify existing assets only”
- Design says `create` is invalid in `maintain`
- Build says file creation under `maintain` is forbidden
- Verify says do not add new tests as a convenience validation shortcut

- [ ] **Step 4: Re-run the install integration test**

Run:

```bash
pnpm exec vitest run test/comet-install.integration.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/comet-adapter/src/assets.ts test/comet-install.integration.test.ts
git commit -m "docs: harden playwright maintain-mode comet guidance"
```

### Task 7: Run Full Verification And Update Plan/Docs References

**Files:**
- Modify: `docs/superpowers/plans/2026-06-15-playwright-impact-mode-enforcement.md` if implementation notes need a short “completed” appendix later

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm exec vitest run \
  packages/comet-adapter/src/playwright-impact-policy.test.ts \
  test/comet-playwright-hooks.integration.test.ts \
  test/comet-playwright-impact-mode.integration.test.ts \
  test/comet-verify.integration.test.ts \
  test/comet-install.integration.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full repo verification**

Run:

```bash
pnpm build
pnpm test
pnpm lint
```

Expected: all commands PASS.

- [ ] **Step 3: Sanity-check user-facing behavior manually**

Use a temp Playwright-mode project and confirm:

```bash
pnpm harness-comet --root <temp-project> comet hook open --change demo-change
pnpm harness-comet --root <temp-project> comet hook design --change demo-change
pnpm harness-comet --root <temp-project> comet hook build --change demo-change
pnpm harness-comet --root <temp-project> comet verify --change demo-change
```

Expected:

- `maintain` + new spec file -> Build/Verify fail
- `full` + new spec file -> Build/Verify pass if other requirements are satisfied
- `off` in onboarded project -> Open/Design fail

- [ ] **Step 4: Commit final verification changes**

```bash
git add .
git commit -m "test: enforce playwright impact modes end to end"
```

---

## Self-Review

- Spec coverage:
  - Stronger `maintain/full/off` semantics: covered by Tasks 1, 3, and 6.
  - Document-level protocol enforcement: covered by Tasks 2 and 3.
  - File-level Build enforcement: covered by Task 4.
  - Verify-time reuse of the same policy: covered by Task 5.
  - Full regression protection: covered by Task 7.
- Placeholder scan:
  - No `TODO` or `TBD` placeholders remain.
  - Every task includes target files, commands, and expected outcomes.
- Type consistency:
  - `mode` values are consistently `full | maintain | off`.
  - `decision` values are consistently `reuse | update | extend | create | none`.
  - Build and Verify both rely on the same policy layer rather than duplicate custom rules.
