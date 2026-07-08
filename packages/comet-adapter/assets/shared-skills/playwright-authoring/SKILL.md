---
name: playwright-authoring
description: Explicitly invoked standalone workflow that turns a concrete requirement into project-consistent Playwright test assets and places each asset in the correct journeys/incidents/data/support directory when that asset is needed.
---

# Playwright Authoring

## Activation contract

This skill is explicit-invocation only.

Activate only when:

1. the user explicitly selects, invokes, or names `playwright-authoring`; and
2. the request includes a concrete requirement, bug description, acceptance criterion, or user workflow.

Do not activate from topic similarity or a general Playwright question.

If explicitly invoked without a concrete requirement, ask for exactly one concrete requirement before inspecting or modifying the repository.

## Responsibility

Analyze the concrete requirement, select the correct Playwright asset shape, implement the required test assets, and verify them.

This is a single standalone authoring workflow. Do not require the user to separately invoke impact-analysis, decision, plan, build, or verify skills. Those stages are incorporated below.

## Storage mode

Persist workflow metadata in one session document:

```text
docs/testing/authoring/<session-id>.md
```

Derive `<session-id>` from a concise, filesystem-safe requirement name. Reuse an explicitly supplied session path when present.

Do not create:

- `openspec/changes/...`;
- `.comet.yaml`;
- Comet phase state;
- `.harness-comet/manifest.json` entries.

## Playwright asset placement model

Resolve the configured Playwright test directory before writing assets:

1. prefer `harness-comet.config.ts` `playwright.testDir` when present;
2. otherwise prefer `playwright.config.ts` `testDir` when it is statically clear;
3. otherwise use `tests`.

When an asset of a given type is needed, place it under the matching directory in `<testDir>`:

```text
<testDir>/
  journeys/    Core long-lived business journeys
  incidents/   Production issue and incident regressions
  data/        Fixed input, expected output, and deterministic JSON data
  support/     Mock, attachment, request capture, canvas, assertion, and helper utilities
```

A requirement does not need to create all four kinds of assets. Create only the files needed to satisfy the requirement and keep each created or updated file in the correct location.

### Placement contract

- Put long-lived core business journey specs under `<testDir>/journeys/`.
- Put production incident regressions under `<testDir>/incidents/`.
- Put fixed input JSON, expected payload JSON, captured API contracts, scenario data, and deterministic test data under `<testDir>/data/`.
- Put mock helpers, attachment helpers, request capture helpers, canvas helpers, custom assertions, API test clients, selectors, factories, and reusable utilities under `<testDir>/support/`.
- Do not place fixed case data in `support/`.
- Do not place helper code in `data/`.
- Do not place incident-only regressions in `journeys/` unless the requirement explicitly promotes the incident into a long-lived core journey.
- Do not create a generated HTML replacement for the product. Tests must exercise the real application boundary unless the requirement is explicitly an infrastructure self-test or example.

## Workflow

### 1. Inspect the repository

Inspect, when present:

```text
package.json
harness-comet.config.ts
playwright.config.ts
configured Playwright test directories
relevant application routes, components, stores, APIs, serializers, and feature flags
existing fixtures, Page Objects, helpers, and test data
```

Run when available:

```bash
pnpm exec playwright test --list
```

Search existing `*.spec.*` files by business behavior, route, production implementation, API, fixture, Page Object, helper, tag, incident ID, imports, and changed source dependencies.

Do not treat filename or keyword similarity alone as proof. Read plausible candidates and explain the relationship in the session document.

### 2. Classify the requirement

Classify the target as exactly one of:

- `business-e2e`;
- `frontend-integration`;
- `component`;
- `api-contract`;
- `infrastructure-self-test`;
- `example`.

Then classify the asset intent as exactly one of:

- `journey`: long-lived core business path;
- `incident`: production issue or incident regression;
- `data-only`: fixed input or expected output asset only;
- `support-only`: reusable helper/mock/assertion/attachment capability only;
- `mixed`: spec plus data/support assets.

### 3. Select target paths

For every required asset, select paths using the placement contract.

Examples:

```text
<testDir>/journeys/annotation-save.spec.ts
<testDir>/incidents/INC-1234-canvas-offset.spec.ts
<testDir>/incidents/INC-1234-canvas-offset/README.md
<testDir>/data/annotation-save-input.json
<testDir>/data/annotation-save-expected-payload.json
<testDir>/support/mock-api.ts
<testDir>/support/attachments.ts
<testDir>/support/canvas-assertions.ts
```

Incident assets may use either a single incident spec file or an incident subdirectory when the regression needs local reproduction notes and incident-specific data. Shared deterministic data still belongs in `<testDir>/data/` when it can be reused by journeys or multiple incidents.

### 4. Plan before writing

Create a concise implementation plan in the session document before editing files. The plan must include:

```yaml
playwrightAuthoringPlan:
  requirementCoverage:
    - requirement: ...
      assertions: [...]
  boundary:
    type: business-e2e
    route: /example
    productionSources: [src/...]
    prerequisites: []
  assetIntent: journey | incident | data-only | support-only | mixed
  targets:
    - path: tests/journeys/example.spec.ts
      operation: verify | update | create | retire
      reason: ...
      assertions: [...]
      relatedAssets: []
  fixtureAndNetworkStrategy: []
  filesToCreate: []
  filesToUpdate: []
  filesToRetire: []
  expectedEvidence: []
  verificationCommands: []
```

Proceed without a separate confirmation when the user explicitly invoked `playwright-authoring` and the target paths are unambiguous. If target selection is ambiguous and multiple placements would be materially different, ask one focused question.

### 5. Implement assets

Implementation rules:

- Exercise the project's real application through its configured Playwright setup.
- Reuse existing fixtures, Page Objects, helpers, factories, data, selectors, and test extensions when appropriate.
- Use deterministic data and controlled external dependencies.
- Use Playwright auto-waiting and web-first assertions.
- Preserve configured reporters and result paths.
- Map each planned requirement branch to direct assertions.
- Attach useful evidence for captured payloads, transformed data, screenshots, or diagnostics when applicable.
- Do not add undeclared targets or unrelated coverage.
- If another target is required, update the plan before writing it.

### 6. Verify assets

Run applicable checks:

```bash
pnpm exec playwright test --list
pnpm exec playwright test <target-test-file>
```

Also run relevant lint and type checks when available.

Confirm:

- every declared runnable target was listed and executed;
- every planned requirement maps to an assertion;
- the approved real route or execution boundary is used;
- named production components, handlers, stores, serializers, or API clients are exercised;
- no generated replacement page substitutes for product behavior;
- fixtures and network controls are deterministic;
- required evidence exists;
- no undeclared test target was added;
- all created or updated files comply with the asset placement contract.

When execution is impossible, report `blocked`, include exact commands attempted, and keep the implemented assets scoped to the approved plan.

## Session document format

Write or update the session document with these sections:

```md
# Playwright Authoring: <title>

## Requirement

## Repository Inspection

## Asset Classification

## Playwright Authoring Plan

## Build Result

## Verification
```

The session document is workflow metadata, not the source of truth for test execution.

## Required final response

Report:

- session document path;
- created, updated, and retired files;
- which files went under `journeys`, `incidents`, `data`, and `support` when applicable;
- real route and production source paths exercised;
- reused fixtures and support assets;
- verification commands and outcomes;
- blockers or product defects;
- whether every requirement was covered.

Do not report success when execution failed, was blocked, or did not exercise the planned production boundary.
