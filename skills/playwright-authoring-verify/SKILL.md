---
name: playwright-authoring-verify
description: Validate and execute the Playwright assets produced from an approved authoring plan. Confirm project consistency, real application coverage, declared target coverage, and actual test results without changing scope.
---

# Playwright Authoring Verify

## Responsibility

Verify that the implemented Playwright assets satisfy the approved plan and execute against the intended application boundary.

Do not create new tests or redesign the plan during verification.

## Inputs

- concrete requirement;
- `playwrightAuthoringDecision`;
- `playwrightAuthoringPlan`;
- `playwrightBuildResult`;
- repository context.

## Required checks

Run all applicable deterministic checks:

```bash
pnpm exec harness-comet validate
pnpm exec harness-comet tests list
pnpm exec playwright test --list
```

Run every created, updated, or explicitly selected `verify` target. Prefer:

```bash
pnpm exec harness-comet run -- <target-test-file>
```

When available, also run relevant lint and type checks:

```bash
pnpm exec eslint <changed-files>
pnpm exec tsc --noEmit
```

## Contract checks

Confirm:

- every declared runnable target was listed and executed;
- every created or updated Harness test includes `@harness`;
- every planned requirement maps to an implemented assertion;
- the test loads the real application route or approved test boundary;
- production components, handlers, stores, serializers, or API clients named in the plan are exercised;
- no synthetic page or duplicated feature implementation replaced the product behavior;
- fixtures and network controls are deterministic;
- required structured evidence was produced;
- no undeclared test target was added.

A passing command is not sufficient if the intended production implementation was not exercised.

## Failure handling

- Implementation defect: return to `playwright-authoring-build` without changing the approved scope.
- Plan defect or missing target: return to `playwright-authoring-plan` and require an updated decision when scope changes.
- Product defect revealed by a correct test: report it; do not weaken the assertion to make the test pass.
- Environment failure: report the exact blocker and commands attempted.

## Required output

```yaml
playwrightVerification:
  status: passed | failed | blocked
  validatedTargets:
    - tests/journeys/example.spec.ts
  commands:
    - command: ...
      exitCode: 0
  requirementCoverage:
    - requirement: ...
      assertion: ...
      result: passed | failed
  productionBoundary:
    route: ...
    sourcePaths:
      - ...
    confirmed: true | false
  evidence:
    - ...
  failures:
    - ...
```

## Completion conditions

Complete only when all declared targets have a recorded result and the final status accurately reflects execution and boundary validation.
