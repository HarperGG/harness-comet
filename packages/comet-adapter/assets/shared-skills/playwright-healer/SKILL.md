---
name: playwright-healer
description: Diagnose failing Playwright tests and apply minimal asset-model-safe repairs to specs, data, or support helpers without weakening business coverage.
---

# Playwright Healer

## Activation contract

Use this skill when the user asks to fix a failing Playwright test, heal generated tests, or when `playwright-authoring` delegates its verification and repair phase.

Requires one or more target Playwright test files, an approved plan, or a failing Playwright command output.

## Responsibility

Run or inspect the failing target, diagnose the failure cause, apply the smallest safe repair, and re-run verification when possible.

Healing must preserve the approved business behavior. Do not weaken assertions just to make a test pass.

## Asset placement model

Repairs must preserve the current Playwright asset placement model:

```text
<testDir>/
  journeys/    Core long-lived business journeys
  incidents/   Production issue and incident regressions
  data/        Fixed input, expected output, and deterministic JSON data
  support/     Mock, attachment, request capture, canvas, assertion, and helper utilities
```

Use the asset type to decide where a repair belongs:

- Locator, flow, and assertion repairs for journey specs stay in `<testDir>/journeys/`.
- Locator, reproduction, and assertion repairs for incident regressions stay in `<testDir>/incidents/`.
- Fixed input, expected output, captured API contract, and deterministic scenario corrections go in `<testDir>/data/`.
- Mock, attachment, request capture, canvas, assertion helper, selector, factory, and reusable utility repairs go in `<testDir>/support/`.

Do not move assets across directories unless the current location violates the placement model and the move is explicitly recorded.

## Healing rules

Allowed repairs include:

- updating stale locators to equivalent user-facing locators;
- replacing brittle waits with Playwright auto-waiting or web-first assertions;
- fixing deterministic fixture data to match the approved scenario;
- fixing mock, capture, attachment, or canvas helper behavior;
- updating expected payload fixtures when the production contract intentionally changed and the approved requirement supports it;
- adding missing evidence attachment calls when required by the plan.

Disallowed repairs include:

- deleting assertions without replacing them with equivalent coverage;
- broadening assertions until they no longer prove the requirement;
- replacing the product with generated HTML or test-only UI;
- hiding real product defects by changing the test expectation;
- adding unrelated coverage or undeclared targets.

When the failure appears to be a product bug, report a product defect instead of weakening the test.

## Required workflow

1. Read the target spec, related data, related support helpers, and the approved plan when available.
2. Run or inspect:

   ```bash
   pnpm exec playwright test --list
   pnpm exec playwright test <target-test-file>
   ```

3. Classify the failure:

   - selector drift;
   - timing or synchronization issue;
   - fixture or deterministic data issue;
   - mock/helper issue;
   - expected contract changed intentionally;
   - product defect;
   - environment or dependency blocker.

4. Apply the smallest safe repair to the correct asset location.
5. Re-run the target command when possible.
6. Stop and report `blocked` if verification cannot run or if the failure is outside test assets.

## Required output

Write the healing result into the current authoring session document or return it to the caller in this shape:

```yaml
playwrightHealing:
  targetFiles: []
  commands:
    attempted: []
    passed: []
    failed: []
  diagnosis:
    classification: selector-drift | timing | fixture-data | mock-helper | expected-contract-change | product-defect | environment-blocker
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

Do not report success unless the target passed or the remaining blocker is clearly outside the test assets.
