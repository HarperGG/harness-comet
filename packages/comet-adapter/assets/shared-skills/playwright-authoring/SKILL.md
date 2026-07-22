---
name: playwright-authoring
description: Project-policy or explicitly invoked workflow that plans, generates, and verifies project-consistent Playwright test assets using the journeys/incidents/data/support model.
---

# Playwright Authoring

## Activation contract

Activate when either condition is true:

1. the user explicitly selects, invokes, or names `playwright-authoring`; or
2. project instructions reference `.agents/playwright.md`, and the current task implements a feature, changes user-visible behavior, fixes a bug or production issue, changes an application workflow, may affect existing behavior, or creates or modifies Playwright assets.

Project-policy activation does not require the user to separately request or approve tests. Do not ask whether tests should be added when `.agents/playwright.md` already makes them part of the default delivery.

Do not activate for documentation-only, comment-only, formatting-only, or clearly non-behavioral changes unless the user explicitly requests Playwright work.

If the request does not contain a concrete requirement, bug description, acceptance criterion, user workflow, or failing target, obtain one concrete requirement before modifying the repository.

## Responsibility

Orchestrate the Playwright authoring loop:

```text
playwright-planner -> playwright-generator -> playwright-healer
```

Use this skill as the user-facing entry point. Delegate detailed work to:

- `playwright-planner`: inspect production code and existing coverage, select `verify`, `update`, `create`, or `none`, and produce a bounded asset plan;
- `playwright-generator`: write the actual repository assets required by `update` or `create`;
- `playwright-healer`: execute every runnable target, diagnose failures, and apply the smallest safe test-asset repair.

Do not require the user to invoke stage skills manually.

## Project policy

When `.agents/playwright.md` exists, read it before planning and treat it as the source of truth for trigger conditions, exemptions, asset placement, test generation, native Playwright verification, and completion reporting.

A request to implement a feature, change behavior, or fix a bug already authorizes necessary Playwright work. The workflow must not stop after planning when the selected action requires test generation or execution.

## Storage mode

For explicit standalone invocations, persist workflow metadata when useful in:

```text
docs/testing/authoring/<session-id>.md
```

For project-policy activation during normal implementation, the session document is optional. Do not let metadata creation delay or replace the actual test asset changes and Playwright execution.

Do not create Comet or OpenSpec state for this standalone workflow.

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

Invoke `playwright-planner` with the original requirement, repository context, `.agents/playwright.md`, and any existing authoring plan.

The planner must:

- inspect relevant production code and plausible existing tests;
- select exactly one action: `verify`, `update`, `create`, or `none`;
- use `none` only for an explicit policy exemption;
- identify the real application boundary;
- map changed behavior and acceptance criteria to direct assertions;
- declare exact target paths and reusable assets;
- define native Playwright verification commands.

### 2. Generate

For `update` or `create`, invoke `playwright-generator` with the plan.

The generator must write the actual repository files. It must not finish with only a plan, example, patch suggestion, or code block in the response.

For `verify`, do not create an unrelated replacement test. Proceed to verification with the existing target.

For `none`, do not modify Playwright assets. Record the exact exemption and proceed to the final report.

### 3. Heal and verify

For every `verify`, `update`, or `create` target, invoke `playwright-healer`.

It must:

- confirm created targets appear in `playwright test --list`;
- execute every created, updated, or selected verification target with the project's package manager;
- diagnose failures and apply only the smallest safe test-asset repair;
- preserve business coverage and never weaken assertions to obtain a pass;
- report product defects or environment blockers instead of hiding them;
- rerun affected targets after a repair.

## Non-negotiable completion gate

Do not report completion unless:

- the action is explicitly recorded as `verify`, `update`, `create`, or policy-exempt `none`;
- every uncovered behavior has a `create` target;
- every partially covered behavior has an `update` target;
- every `update` and `create` target was written to the repository;
- every `verify`, `update`, and `create` target was discovered and executed;
- all required target executions passed.

`playwright test --list`, build, type checking, lint, and unit tests do not replace target Playwright execution.

## Required final response

Report:

- selected test action and rationale;
- created, updated, verified, and retired files;
- placement under `journeys`, `incidents`, `data`, and `support` when applicable;
- real route and production source paths exercised;
- reused fixtures, Page Objects, helpers, selectors, and data;
- native Playwright commands and outcomes;
- repairs, blockers, or product defects;
- whether every requirement maps to a passing assertion.

Do not report success when required tests were not written, were not discovered, failed, were blocked, or did not exercise the planned production boundary.
