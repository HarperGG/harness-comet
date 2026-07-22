---
name: playwright-generator
description: Generate or update executable Playwright assets from an approved plan, writing actual repository files under the journeys/incidents/data/support model.
---

# Playwright Generator

## Activation contract

Use this skill when the user asks to generate Playwright tests from a plan or when `playwright-authoring` delegates generation.

Requires an explicit Playwright plan. If no plan exists, invoke `playwright-planner` first.

## Responsibility

Create, update, or retire only the assets declared by the plan. Write the actual repository files; do not finish with only examples, suggested patches, or code blocks in the response.

## Action contract

- `create`: create every declared target and required related asset.
- `update`: modify every declared target that needs new behavior coverage.
- `verify`: do not create or modify an unrelated replacement test; return the existing targets for execution.
- `none`: do not modify Playwright assets.

If the plan requires a new path, update the plan before writing it.

## Asset placement model

Use the test directory resolved by the plan:

```text
<testDir>/
  journeys/    Core long-lived business journeys
  incidents/   Bug, production issue, and incident regressions
  data/        Fixed input, expected output, and deterministic JSON data
  support/     Fixtures, mocks, selectors, assertions, factories, and helpers
```

Generate only the asset types required by the approved plan.

## Placement contract

- Long-lived core business specs go under `<testDir>/journeys/`.
- Bug and production regression specs go under `<testDir>/incidents/`.
- Fixed input JSON, expected payload JSON, captured contracts, and deterministic data go under `<testDir>/data/`.
- Reusable fixtures, mocks, selectors, assertions, API clients, factories, and helpers go under `<testDir>/support/`.
- Fixed case data must not be placed in `support/`.
- Helper code must not be placed in `data/`.

## Generation rules

- Exercise the real application through its configured Playwright setup.
- Prove user-visible business outcomes, not only element existence.
- Reuse existing fixtures, Page Objects, helpers, factories, data, selectors, and test extensions when appropriate.
- Use deterministic data and controlled external dependencies.
- Use Playwright locators, auto-waiting, and web-first assertions.
- Map each planned behavior branch to direct assertions.
- Preserve configured reporters and result paths.
- Attach useful screenshots, payloads, attachments, or diagnostics when applicable.
- Do not replace the product with generated HTML or test-authored behavior.
- Do not mock the business capability being tested.
- Do not add undeclared targets, duplicate reusable assets, or unrelated coverage.

## Required implementation record

```yaml
playwrightGeneration:
  action: verify | update | create | none
  createdFiles: []
  updatedFiles: []
  retiredFiles: []
  verifiedWithoutChanges: []
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
    targets: []
    notes: []
  blockers: []
```

Every `create` and `update` target must be traceable to an actual written repository file and a planned requirement assertion. Do not report generation complete when a required file was only described but not written.
