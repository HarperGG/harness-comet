---
name: playwright-authoring
description: Explicit Playwright workflow that plans, generates, executes, and repairs project-consistent test assets using the journeys/incidents/data/support model.
---

# Playwright Authoring

## Activation contract

This skill is on-demand. Activate only when the user explicitly:

1. selects, invokes, or names `playwright-authoring`;
2. requests Playwright, E2E, browser, or regression-test coverage;
3. asks to create, update, repair, execute, or verify Playwright tests for a concrete requirement, bug, acceptance criterion, workflow, or failing target.

Do not activate merely because:

- a feature is being implemented;
- a bug is being fixed;
- user-visible behavior changes;
- `.agents/playwright.md` exists;
- project instructions mention Playwright;
- Playwright skills are installed.

A normal implementation request does not implicitly authorize Playwright authoring. Do not ask whether tests should be added unless the user is already discussing Playwright work.

If explicitly invoked without a concrete requirement, bug description, acceptance criterion, workflow, approved plan, or failing target, obtain one concrete target before modifying Playwright assets.

## Responsibility

Orchestrate the Playwright authoring loop:

```text
playwright-planner -> playwright-generator -> playwright-healer
```

Use this skill as the user-facing entry point. Delegate detailed work to:

- `playwright-planner`: inspect production code and plausible existing coverage, select `verify`, `update`, `create`, or `none`, and produce a bounded asset plan;
- `playwright-generator`: write the actual repository assets required by `update` or `create`;
- `playwright-healer`: execute every runnable target, diagnose failures, and apply the smallest safe test-asset repair.

Do not require the user to invoke stage skills manually.

## Project policy

When this skill has been explicitly activated and `.agents/playwright.md` exists, read it before planning and treat it as the source of truth for asset placement, test generation, native Playwright verification, and completion reporting.

The presence of `.agents/playwright.md` is not itself an activation signal.

## Storage mode

For explicit standalone invocations, persist workflow metadata when useful in:

```text
docs/testing/authoring/<session-id>.md
```

Do not let metadata creation delay or replace the actual test asset changes and Playwright execution. Do not create Comet or OpenSpec state for this standalone workflow.

## Playwright asset placement model

Resolve the configured Playwright test directory and preserve this model:

```text
<testDir>/journeys/    Core long-lived business journeys
<testDir>/incidents/   Bug, production issue, and incident regressions
<testDir>/data/        Fixed input, expected output, and deterministic JSON data
<testDir>/support/     Fixtures, mocks, selectors, assertions, factories, and helpers
```

Create only the asset types needed by the requirement.

## Required workflow

### 1. Plan

Invoke `playwright-planner` with the explicit Playwright request, repository context, `.agents/playwright.md`, and any existing authoring plan.

The planner must:

- inspect relevant production code and plausible existing tests without scanning unrelated areas;
- select exactly one action: `verify`, `update`, `create`, or `none`;
- identify the real application boundary;
- map requested behavior and acceptance criteria to direct assertions;
- declare exact target paths and reusable assets;
- define native Playwright verification commands.

### 2. Generate

For `update` or `create`, invoke `playwright-generator` with the plan. The generator must write the actual repository files and must not finish with only a plan, example, patch suggestion, or code block.

For `verify`, proceed with the existing target without creating an unrelated replacement test. For `none`, do not modify Playwright assets and record the reason.

### 3. Heal and verify

For every `verify`, `update`, or `create` target, invoke `playwright-healer`.

It must:

- confirm created targets appear in `playwright test --list`;
- execute every created, updated, or selected verification target with the project's package manager;
- diagnose failures and apply only the smallest safe test-asset repair;
- preserve business coverage and never weaken assertions to obtain a pass;
- report product defects or environment blockers instead of hiding them;
- rerun affected targets after a repair.

## Completion gate

For an explicitly activated Playwright task, do not report Playwright completion unless:

- the action is recorded as `verify`, `update`, `create`, or justified `none`;
- every required `update` and `create` target was written to the repository;
- every `verify`, `update`, and `create` target was discovered and executed;
- all required target executions passed.

`playwright test --list`, build, type checking, lint, and unit tests do not replace target Playwright execution.

## Required final response

Report the selected test action and rationale, created/updated/verified/retired files, real route and production sources exercised, reused assets, native Playwright commands and outcomes, repairs or blockers, and whether every requested behavior maps to a passing assertion.

Do not report success when required tests were not written, were not discovered, failed, were blocked, or did not exercise the planned production boundary.
