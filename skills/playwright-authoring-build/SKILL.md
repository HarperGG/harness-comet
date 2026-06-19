---
name: playwright-authoring-build
description: Implement an approved Playwright authoring plan as complete, project-consistent test assets against the real application. Modify only declared targets and required support assets; do not redesign scope.
---

# Playwright Authoring Build

## Responsibility

Implement the approved `playwrightAuthoringPlan` completely and only within its declared scope.

## Inputs

- concrete requirement;
- confirmed `playwrightAuthoringDecision`;
- approved `playwrightAuthoringPlan`;
- repository context.

If the decision is disabled or the plan is a no-op, do not modify files.

## Core testing principle

> For an existing product feature, test the real implementation. Mock dependencies, never the feature itself.

A passing test is invalid when it only verifies HTML, client logic, payload construction, or state transitions authored inside the test.

## Implementation rules

- Exercise the actual application through configured `baseURL`, `webServer`, application fixture, or the repository's established component-test setup.
- Reuse project fixtures, Page Objects, helpers, factories, data, selectors, and test extensions when correct.
- Use deterministic setup and controlled backend/API dependencies.
- Capture real outgoing requests when payload or persistence behavior is part of the requirement.
- Use Playwright auto-waiting and web-first assertions.
- Never use `page.waitForTimeout(...)`.
- Every generated Harness test must include `@harness`.
- Reuse existing domain tags before creating new ones.
- Place journeys, incidents, data, support files, and evidence in configured locations.
- Preserve Harness-Comet reporter configuration.

For a business UI requirement, do not use:

- `page.setContent(...)`;
- `data:` or `about:blank` pages followed by DOM construction;
- main-document route fulfillment with generated HTML;
- inline scripts that reimplement the product behavior;
- test-only pages or mock components that replace the feature under test.

## Assertion rules

Map every planned requirement branch to a direct assertion. Use applicable layers:

- visible behavior;
- route or navigation;
- state transition;
- request count or request absence;
- real outgoing payload;
- persisted result;
- error, permission, cancellation, or negative behavior.

For negative behavior, prove the forbidden side effect did not occur.

## Scope enforcement

- Modify only plan-declared target tests and required related assets.
- Do not add speculative coverage.
- Do not redesign test architecture.
- Do not modify production code unless an explicitly identified missing testability hook blocks the plan and the user has permitted that production change.
- If a new undeclared target is required, stop and return to `playwright-authoring-decision` and `playwright-authoring-plan`.

## Required output

Return:

```yaml
playwrightBuildResult:
  createdFiles:
    - ...
  updatedFiles:
    - ...
  retiredFiles:
    - ...
  reusedAssets:
    - ...
  productionBoundary:
    route: ...
    sourcePaths:
      - ...
  requirementAssertions:
    - requirement: ...
      assertionLocation: tests/...:line
  pendingVerification:
    - ...
```

## Completion conditions

Complete only when all non-verify implementation targets are implemented, no undeclared scope was added, and the result is ready for `playwright-authoring-verify`.
