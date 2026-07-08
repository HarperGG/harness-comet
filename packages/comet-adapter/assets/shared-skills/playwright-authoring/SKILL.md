---
name: playwright-authoring
description: Explicitly invoked standalone workflow that orchestrates playwright-planner, playwright-generator, and playwright-healer to create project-consistent Playwright test assets using the journeys/incidents/data/support placement model.
---

# Playwright Authoring

## Activation contract

This skill is explicit-invocation only.

Activate only when:

1. the user explicitly selects, invokes, or names `playwright-authoring`; and
2. the request includes a concrete requirement, bug description, acceptance criterion, user workflow, approved test plan, or failing Playwright test target.

Do not activate from topic similarity or a general Playwright question.

If explicitly invoked without a concrete requirement, plan, or failing target, ask for exactly one concrete requirement before inspecting or modifying the repository.

## Responsibility

Orchestrate the Playwright authoring loop:

```text
playwright-planner -> playwright-generator -> playwright-healer
```

Use this skill as the user-facing entry point. Delegate the detailed stage work to the three focused skills:

- `playwright-planner`: inspect the repository, classify the requirement, and produce an asset plan;
- `playwright-generator`: create or update only the assets declared by the approved plan;
- `playwright-healer`: run, diagnose, and minimally repair failing generated or existing Playwright assets.

Do not require the user to invoke the stage skills manually. Use them internally unless the user explicitly asks for only one stage.

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

The authoring workflow must preserve the current Playwright test asset model. The stage skills own the detailed placement rules, but the entry-point contract is:

```text
<testDir>/
  journeys/    Core long-lived business journeys
  incidents/   Production issue and incident regressions
  data/        Fixed input, expected output, and deterministic JSON data
  support/     Mock, attachment, request capture, canvas, assertion, and helper utilities
```

A requirement does not need to create all four kinds of assets. Create only the files needed to satisfy the requirement and keep each created or updated file in the correct location.

## Required workflow

### 1. Plan

Invoke `playwright-planner` with:

- the original user requirement, bug report, acceptance criterion, workflow, approved plan, or failing target;
- current repository context;
- any existing authoring session document.

The planner must produce or update a plan that includes:

- resolved Playwright test directory;
- requirement classification;
- asset intent;
- real application boundary;
- planned asset paths;
- fixture and network strategy;
- expected evidence;
- verification commands.

Persist the planner output under:

```md
## Playwright Plan
```

### 2. Generate

Invoke `playwright-generator` with the approved or explicit plan.

The generator must:

- create, update, or retire only planned assets;
- place specs, data, and support files according to the asset placement model;
- reuse existing project fixtures, helpers, data, Page Objects, and selectors when appropriate;
- keep generated tests tied to the real application boundary;
- report any new required asset by updating the plan before writing it.

Persist the generator output under:

```md
## Playwright Generation
```

### 3. Heal and verify

Invoke `playwright-healer` when:

- generation produced runnable test targets;
- the user supplied failing Playwright output;
- an existing target needs repair;
- verification fails after generation.

The healer must:

- run or inspect the target command;
- diagnose the failure cause;
- apply the smallest safe repair to the correct asset location;
- preserve business coverage and avoid weakening assertions;
- report product defects instead of hiding them in test code;
- rerun verification when possible.

Persist the healer output under:

```md
## Playwright Healing and Verification
```

## Session document format

Write or update the session document with these sections:

```md
# Playwright Authoring: <title>

## Requirement

## Playwright Plan

## Playwright Generation

## Playwright Healing and Verification

## Final Asset Summary
```

The session document is workflow metadata, not the source of truth for test execution.

## Required final response

Report:

- session document path;
- created, updated, and retired files;
- which files went under `journeys`, `incidents`, `data`, and `support` when applicable;
- real route and production source paths exercised;
- reused fixtures, data, and support assets;
- verification commands and outcomes;
- healer repairs, if any;
- blockers or product defects;
- whether every requirement was covered.

Do not report success when execution failed, was blocked, or did not exercise the planned production boundary.
