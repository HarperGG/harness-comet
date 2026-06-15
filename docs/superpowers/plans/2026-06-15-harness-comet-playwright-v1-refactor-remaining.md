# Harness Comet Playwright V1 Refactor Remaining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Playwright-mode V1 refactor described in `/Users/gangyang/Downloads/harness-comet-playwright-v1-refactor-design.md` without changing Runtime behavior.

**Architecture:** Keep Runtime and Playwright execution paths isolated. Reuse the already-landed package-manager, listing, action parsing, and incident foundations; finish the remaining Playwright-specific template, skill patch, reporter, verify, and archive layers with deterministic CLI and file-based artifacts.

**Tech Stack:** TypeScript, Vitest, Playwright, Commander, Zod, existing `@harness-comet/schema`, `@harness-comet/core`, `@harness-comet/cli`, `@harness-comet/playwright`, and `@harness-comet/comet-adapter`.

---

## Scope And Assumptions

- The design doc is treated as the contract.
- Runtime mode remains unchanged.
- Current in-flight changes in the workspace are intentional and should be extended, not replaced.
- Phases 1-3 from the design doc are largely implemented already; this plan focuses on completing and hardening the remaining work.

## Current Status Snapshot

Already present in the repo or currently in progress:

- Shared package-manager detection and runner command building
- Playwright `tests list` via reporter-backed discovery
- `validate` no longer depends on `defineHarnessScenario(...)`
- Playwright action model: `none`, `verify-existing`, `update-or-create`
- `impact set/show` action flow
- Hook parsing and partial verify/archive migration
- Incident schema, validation, and `create incident`

Still incomplete or needing end-to-end verification:

- Rich Playwright init template
- Skill patch v2 with anchor-aware insertion
- Structured Playwright reporter output
- Verify markdown report and receipt v2
- Archive freshness checks based on results/report/asset hash
- Final schema/config defaults and broader integration coverage

## File Map

### Primary Modify Targets

- `packages/cli/src/templates/playwright-mode.ts`
- `packages/cli/src/commands/init.ts`
- `packages/comet-adapter/src/assets.ts`
- `packages/comet-adapter/src/hooks.ts`
- `packages/comet-adapter/src/verify.ts`
- `packages/comet-adapter/src/archive-check.ts`
- `packages/comet-adapter/src/types.ts`
- `packages/core/src/playwright/validate.ts`
- `packages/core/src/index.ts`
- `packages/playwright/src/index.ts`
- `packages/playwright/package.json`
- `packages/schema/src/index.ts`

### Primary Create Targets

- `packages/playwright/src/reporter.ts`
- `packages/playwright/src/reporter.test.ts`
- `packages/cli/src/templates/incident.ts`
- `test/playwright-reporter.integration.test.ts`
- `test/comet-playwright-none-verify.integration.test.ts`
- `test/playwright-package-manager.integration.test.ts` if current coverage still misses CLI/comet callsites

### Existing Tests To Extend

- `test/playwright-mode-init.integration.test.ts`
- `test/playwright-mode-validate.integration.test.ts`
- `test/comet-playwright-hooks.integration.test.ts`
- `test/comet-playwright-verify.integration.test.ts`
- `test/impact.integration.test.ts`

## Phase 4A: Finish Init Template

**Files:**

- Modify: `packages/cli/src/templates/playwright-mode.ts`
- Modify: `packages/cli/src/commands/init.ts`
- Test: `test/playwright-mode-init.integration.test.ts`

- [ ] Add or keep failing expectations for the richer initialized tree:
  - `tests/journeys/example-save-flow.spec.ts`
  - `tests/incidents/README.md`
  - `tests/data/example-input.json`
  - `tests/data/example-expected-payload.json`
  - `tests/support/mock-api.ts`
  - `tests/support/attachments.ts`
  - `tests/fixtures.ts`
  - `docs/testing/authoring-guide.md`
  - `docs/testing/incident-guide.md`
  - `docs/testing/acceptance-criteria.md`
- [ ] Replace the Hello World example with an independently runnable save-flow example using:
  - fixed input data
  - request mocking
  - request capture
  - payload assertion
  - JSON attachment
  - `@harness` tag
- [ ] Remove old init-only impact config output from the generated `harness-comet.config.ts`.
- [ ] Add helper templates for `mockJson(page, url, body, status)` and `attachJson(testInfo, name, value)`.
- [ ] Run `pnpm test -- --run test/playwright-mode-init.integration.test.ts`.
- [ ] Run `pnpm build`.

## Phase 4B: Close Config And Validate Gaps

**Files:**

- Modify: `packages/schema/src/index.ts`
- Modify: `packages/schema/src/schema.test.ts`
- Modify: `packages/core/src/playwright/validate.ts`
- Test: `test/playwright-mode-validate.integration.test.ts`

- [ ] Add or confirm Playwright config defaults from the design doc:
  - `assetRoots`
  - `resultsFile`
  - `incidents.directory`
  - `incidents.requireIssueUrl`
  - `incidents.requireReadme`
  - `validation.forbidOnly`
  - `validation.longWaitWarningMs`
- [ ] Extend validation to use configured `resultsFile` and `incidents.directory` instead of hard-coded assumptions.
- [ ] Keep core validation failures strict, but warnings heuristic and non-blocking.
- [ ] Verify `defineHarnessScenario` stays optional and no old metadata-specific error remains.
- [ ] Run:
  - `pnpm test -- --run packages/schema/src/schema.test.ts`
  - `pnpm test -- --run packages/core/src/playwright/validate.test.ts test/playwright-mode-validate.integration.test.ts`

## Phase 5: Skill Patch V2

**Files:**

- Modify: `packages/comet-adapter/src/assets.ts`
- Modify: `packages/comet-adapter/src/types.ts`
- Test: existing comet patch/install tests plus add new cases if missing

- [ ] Introduce patch version 2 managed blocks:
  - `<!-- harness-comet:start phase=<phase> version=2 -->`
  - `<!-- harness-comet:end phase=<phase> -->`
- [ ] Implement insertion strategy:
  - replace existing managed block in place
  - otherwise insert before a supported completion anchor
  - otherwise append
  - never inject into fenced code blocks
- [ ] Slim Playwright patch content to phase gates and references to `docs/testing`.
- [ ] Preserve upgrade compatibility from version 1 without duplicating blocks.
- [ ] Add tests for:
  - replace existing block
  - insert before anchor
  - append fallback
  - fenced code protection

## Phase 6: Structured Reporter

**Files:**

- Create: `packages/playwright/src/reporter.ts`
- Modify: `packages/playwright/src/index.ts`
- Modify: `packages/playwright/package.json`
- Test: `packages/playwright/src/reporter.test.ts`
- Test: `test/playwright-reporter.integration.test.ts`

- [ ] Implement `HarnessPlaywrightResultsV1` writer at `test-results/harness-comet/results.json`.
- [ ] Capture per-test:
  - project
  - file
  - title
  - tags
  - annotations
  - status
  - duration
  - retry
  - errors
  - attachments
- [ ] Use stable relative paths and atomic file writes.
- [ ] Ensure reporter errors never hide actual Playwright test failures.
- [ ] Export the reporter in the package manifest for CLI/comet consumption.
- [ ] Run:
  - `pnpm test -- --run packages/playwright/src/reporter.test.ts`
  - `pnpm test -- --run test/playwright-reporter.integration.test.ts`

## Phase 7: Verify Report And Receipt V2

**Files:**

- Modify: `packages/comet-adapter/src/verify.ts`
- Modify: `packages/comet-adapter/src/change.ts`
- Modify: `packages/core/src/index.ts`
- Test: `test/comet-playwright-verify.integration.test.ts`
- Test: add `test/comet-playwright-none-verify.integration.test.ts` if absent

- [ ] For `action: none`, skip Playwright execution and emit schema version 2 receipt with `status: "not-applicable"`.
- [ ] For non-`none` actions, run only declared non-`retire` targets.
- [ ] Read the reporter JSON and fail if:
  - results file is missing
  - any declared target has no result
  - any target failed
- [ ] Write markdown report to `docs/superpowers/reports/<date>-<change>-harness.md`.
- [ ] Write `PlaywrightVerifyReceiptV2` with:
  - action
  - target tests
  - results path
  - report path
  - evidence count
  - config hash
  - asset hash
  - git tree hash
- [ ] Run:
  - `pnpm test -- --run test/comet-playwright-verify.integration.test.ts`
  - `pnpm test -- --run test/comet-playwright-none-verify.integration.test.ts`

## Phase 8: Archive Freshness

**Files:**

- Modify: `packages/comet-adapter/src/archive-check.ts`
- Test: extend archive integration coverage

- [ ] Require receipt presence and action consistency.
- [ ] For non-`none`, require:
  - `status: "passed"`
  - results file exists
  - report exists
  - target files still exist
  - incident metadata remains valid
- [ ] Compute stale detection from:
  - `playwright.config.ts`
  - `harness-comet.config.ts`
  - configured `assetRoots` defaulting to `testDir`
- [ ] Fail with explicit stale/result-missing error codes from the design doc.

## Phase 9: Hook And Build Hardening

**Files:**

- Modify: `packages/comet-adapter/src/hooks.ts`
- Test: `test/comet-playwright-hooks.integration.test.ts`

- [ ] Ensure Open hook validates:
  - action
  - reason
  - confirmed by
  - confirmed at
- [ ] Ensure Design hook enforces target operation matrix:
  - `none` => no targets
  - `verify-existing` => `verify|update`
  - `update-or-create` => `verify|update|create|retire`
- [ ] Ensure Build hook enforces:
  - `none` with test changes fails
  - `verify-existing` requires listed target files to exist and be discoverable
  - `update-or-create` requires declared creates to exist by build time
- [ ] Re-run focused hook integration tests.

## Phase 10: Final Compatibility Sweep

**Files:**

- Modify only where failures reveal real gaps
- Test: full relevant matrix

- [ ] Run focused Playwright-mode suite:
  - `pnpm test -- --run test/playwright-mode-init.integration.test.ts`
  - `pnpm test -- --run test/playwright-mode-validate.integration.test.ts`
  - `pnpm test -- --run test/impact.integration.test.ts`
  - `pnpm test -- --run test/comet-playwright-hooks.integration.test.ts`
  - `pnpm test -- --run test/comet-playwright-impact-mode.integration.test.ts`
  - `pnpm test -- --run test/comet-playwright-verify.integration.test.ts`
  - `pnpm test -- --run test/playwright-incident-create.integration.test.ts`
  - `pnpm test -- --run test/playwright-incident-validate.integration.test.ts`
- [ ] Run package-level unit tests for newly touched modules.
- [ ] Run `pnpm build`.
- [ ] Run an existing Runtime smoke subset to prove no cross-mode regression.

## Completion Criteria

- [ ] Runtime behavior remains unchanged.
- [ ] Playwright init produces the richer example project from the design doc.
- [ ] Action-based impact flow is the only write path for Playwright mode.
- [ ] `tests list` and validate rely on Playwright-native collection, not source regex.
- [ ] Incident assets can be created and validated.
- [ ] Skill patches are idempotent and anchor-aware.
- [ ] Verify emits results JSON, markdown report, and receipt v2.
- [ ] Archive can detect stale verification state.
- [ ] Full focused Playwright-mode test matrix passes.
- [ ] `pnpm build` passes.
