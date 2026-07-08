---
name: playwright-generator
description: Generate or update Playwright test assets from an approved plan, placing specs, data, and support files into the correct journeys/incidents/data/support directories.
---

# Playwright Generator

## Activation contract

Use this skill when the user asks to generate Playwright tests from a plan, or when `playwright-authoring` delegates its generation phase.

Requires an approved or explicit Playwright plan. If no plan exists, invoke or request `playwright-planner` first.

## Responsibility

Create, update, or retire only the assets declared by the plan.

The generator converts planned assets into executable project-consistent Playwright files. It does not broaden scope, add unrelated coverage, or invent new target paths without updating the plan.

## Asset placement model

Use the test directory resolved by the plan. If the plan did not resolve it, resolve it before writing:

1. prefer `harness-comet.config.ts` `playwright.testDir` when present;
2. otherwise prefer `playwright.config.ts` `testDir` when it is statically clear;
3. otherwise use `tests`.

When an asset of a given type is needed, write it under the matching directory in `<testDir>`:

```text
<testDir>/
  journeys/    Core long-lived business journeys
  incidents/   Production issue and incident regressions
  data/        Fixed input, expected output, and deterministic JSON data
  support/     Mock, attachment, request capture, canvas, assertion, and helper utilities
```

A requirement does not need all four asset types. Generate only the files needed by the approved plan.

## Placement contract

- Long-lived core business journey specs go under `<testDir>/journeys/`.
- Production incident regression specs and incident-local reproduction notes go under `<testDir>/incidents/`.
- Fixed input JSON, expected payload JSON, captured API contracts, scenario data, and deterministic test data go under `<testDir>/data/`.
- Mock helpers, attachment helpers, request capture helpers, canvas helpers, custom assertions, API test clients, selectors, factories, and reusable utilities go under `<testDir>/support/`.
- Fixed case data must not be placed in `support/`.
- Helper code must not be placed in `data/`.
- Incident-only regressions must not be placed in `journeys/` unless the plan says the behavior was promoted to a long-lived core journey.

## Generation rules

- Exercise the project's real application through its configured Playwright setup.
- Reuse existing fixtures, Page Objects, helpers, factories, data, selectors, and test extensions when appropriate.
- Use deterministic data and controlled external dependencies.
- Use Playwright auto-waiting and web-first assertions.
- Preserve configured reporters and result paths.
- Map each planned requirement branch to direct assertions.
- Attach useful evidence for captured payloads, transformed data, screenshots, or diagnostics when applicable.
- Do not create a generated HTML replacement for the product unless the approved plan is explicitly an infrastructure self-test or example.
- Do not add undeclared targets or unrelated coverage.
- If a new file becomes necessary, update the plan first and explain why.

## Required implementation record

Write the generation result into the current authoring session document or return it to the caller in this shape:

```yaml
playwrightGeneration:
  createdFiles: []
  updatedFiles: []
  retiredFiles: []
  reusedAssets: []
  placement:
    journeys: []
    incidents: []
    data: []
    support: []
  requirementAssertions:
    - requirement: ...
      implementedBy: []
  pendingVerification:
    commands: []
    notes: []
  blockers: []
```

Every created or updated path must be traceable back to the approved plan and the placement contract.
