---
name: playwright-healer
description: Execute and diagnose Playwright targets, applying minimal asset-model-safe repairs without weakening business coverage.
---

# Playwright Healer

## Activation contract

Use this skill when the user asks to fix a failing Playwright test or when `playwright-authoring` delegates execution, verification, and repair.

Requires target Playwright files, an approved plan, or failing Playwright output.

## Responsibility

Confirm test discovery, execute every required target, diagnose failures, apply the smallest safe test-asset repair, and rerun affected targets.

Healing must preserve the approved business behavior. Do not weaken assertions just to make a test pass.

## Asset placement model

Repairs preserve:

```text
<testDir>/
  journeys/    Core long-lived business journeys
  incidents/   Bug, production issue, and incident regressions
  data/        Fixed input, expected output, and deterministic JSON data
  support/     Fixtures, mocks, selectors, assertions, factories, and helpers
```

Do not move assets unless the current location violates the model and the move is recorded.

## Required execution

Use the project's package manager. Prefer:

```bash
pnpm exec playwright test --list
pnpm exec playwright test <target-test-file>
```

Mandatory conditions:

1. every created target appears in the `--list` output;
2. every `verify`, `update`, and `create` target is executed;
3. every required target passes before success is reported.

`playwright test --list`, build, type checking, lint, and unit tests do not replace target Playwright execution.

When a shared fixture, Page Object, selector, factory, or support helper changes, execute every directly affected spec.

## Healing rules

Allowed repairs include:

- updating stale locators to equivalent user-facing locators;
- replacing brittle waits with auto-waiting or web-first assertions;
- fixing deterministic fixture data to match the approved scenario;
- fixing mock, capture, attachment, canvas, selector, or assertion helper behavior;
- updating expected payload fixtures only when the intended production contract changed;
- adding planned diagnostic evidence.

Disallowed repairs include:

- deleting assertions without equivalent replacement coverage;
- weakening or broadening assertions until they no longer prove the requirement;
- replacing the product with generated HTML or test-only UI;
- hiding a real product defect by changing the expectation;
- adding unrelated coverage or undeclared targets.

## Failure workflow

1. Read the target spec, related data, support helpers, production source, and plan.
2. Confirm discovery and run the target.
3. Classify the failure as selector drift, synchronization, fixture data, mock/helper, intentional contract change, product defect, or environment blocker.
4. Apply the smallest safe test-asset repair when appropriate.
5. Rerun every affected target.
6. Report `blocked` when the environment prevents execution.
7. Report a product defect instead of weakening a correct test.

## Required output

```yaml
playwrightHealing:
  status: passed | failed | blocked
  targetFiles: []
  commands:
    attempted: []
    passed: []
    failed: []
  discovery:
    listedTargets: []
    missingTargets: []
  diagnosis:
    classification: selector-drift | timing | fixture-data | mock-helper | expected-contract-change | product-defect | environment-blocker | none
    evidence: []
  repairs:
    updatedFiles: []
    movedFiles: []
    rationale: []
  placementCheck:
    journeys: []
    incidents: []
    data: []
    support: []
  remainingBlockers: []
```

Do not report success unless every required target was discovered, executed, and passed.
