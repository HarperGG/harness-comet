---
name: playwright-authoring-plan
description: Turn a confirmed Playwright authoring decision into a bounded, repository-specific implementation plan covering the real application boundary, exact target files, assertions, fixtures, related assets, and verification commands. Do not implement files.
---

# Playwright Authoring Plan

## Responsibility

Create the complete implementation contract for the authorized Playwright work.

This skill plans only. It must not edit production or test files.

## Inputs

- concrete requirement and acceptance criteria;
- `playwrightImpactAnalysis`;
- `playwrightAuthoringDecision`;
- repository context;
- optional Comet/OpenSpec design context.

If `enabled` is false, return a no-op plan and stop.

## Required planning work

For every non-ignored target:

1. classify the test boundary as exactly one of:
   - `business-e2e`;
   - `frontend-integration`;
   - `component`;
   - `api-contract`;
   - `infrastructure-self-test`;
   - `example`;
2. identify the real application route or execution entry;
3. identify relevant production source paths;
4. identify existing fixtures, Page Objects, helpers, API clients, selectors, and data to reuse;
5. choose the smallest correct asset change;
6. map every required behavior and branch to concrete assertions;
7. define deterministic fixture, authentication, feature-flag, clock, and network strategy;
8. list expected evidence and verification commands.

For existing product behavior, default to the real application boundary. Do not plan synthetic replacement pages, generated HTML, or test-side reimplementations of the feature.

## Target rules

- `verify`: no planned source edits; list exact test path and expected assertions to revalidate.
- `update`: list the existing test and every support asset that must change.
- `create`: resolve a project-consistent path and explain why extending an existing journey is not more correct.
- `retire`: identify the removed product behavior and all references that must be cleaned up.
- `ignore`: exclude from implementation.

Do not add targets not present in the confirmed decision. If implementation requires an undeclared target, return to the decision step.

## Required output

```yaml
playwrightAuthoringPlan:
  requirementCoverage:
    - requirement: ...
      assertions:
        - ...
  boundary:
    type: business-e2e
    route: /example
    productionSources:
      - src/...
    prerequisites:
      - ...
  targets:
    - path: tests/journeys/example.spec.ts
      operation: update
      reason: ...
      assertions:
        - ...
      relatedAssets:
        - tests/data/example.json
  fixtureAndNetworkStrategy:
    - ...
  filesToCreate:
    - ...
  filesToUpdate:
    - ...
  filesToRetire:
    - ...
  expectedEvidence:
    - ...
  verificationCommands:
    - pnpm exec harness-comet validate
    - pnpm exec playwright test --list
```

## Completion conditions

Complete only when:

- every confirmed target has a concrete plan;
- every acceptance criterion maps to an assertion;
- real route and production source paths are identified for business UI behavior;
- file create/update/retire lists are explicit;
- the plan is sufficient for `playwright-authoring-build` to implement without guessing scope.
