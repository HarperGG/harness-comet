---
name: playwright-authoring-verify
description: Validate and execute Playwright assets from an approved authoring plan without changing scope.
---

<!-- Managed by @hapergg/harness-comet. -->

# Playwright Authoring Verify

## Responsibility

Verify that implemented Playwright assets satisfy the approved plan and exercise the intended application boundary.

Do not create new tests or redesign the plan during verification.

## Required checks

Run applicable checks:

```bash
pnpm exec harness-comet validate
pnpm exec harness-comet tests list
pnpm exec playwright test --list
```

Run every created, updated, or explicitly selected `verify` target, preferably with:

```bash
pnpm exec harness-comet run -- <target-test-file>
```

Also run relevant lint and type checks when available.

Confirm:

- every declared runnable target was listed and executed;
- every created or updated Harness test contains `@harness`;
- every planned requirement maps to an assertion;
- the approved real route or execution boundary is used;
- named production components, handlers, stores, serializers, or API clients are exercised;
- no generated replacement page substitutes for product behavior;
- fixtures and network controls are deterministic;
- required evidence exists;
- no undeclared test target was added.

## Failure handling

- implementation defect: return to Build without changing scope;
- plan defect or missing target: return to planning and update the decision if scope changes;
- product defect revealed by a correct test: report it without weakening assertions;
- environment failure: report the exact blocker and attempted commands.

## Required output

```yaml
playwrightVerification:
  status: passed | failed | blocked
  validatedTargets: []
  commands: []
  requirementCoverage: []
  productionBoundary:
    route: ...
    sourcePaths: []
    confirmed: true | false
  evidence: []
  failures: []
```
