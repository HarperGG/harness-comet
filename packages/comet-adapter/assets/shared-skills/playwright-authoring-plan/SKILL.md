---
name: playwright-authoring-plan
description: Turn a confirmed Playwright authoring decision into a bounded repository-specific implementation plan. Do not implement files.
---

<!-- Managed by @hapergg/harness-comet. -->

# Playwright Authoring Plan

## Responsibility

Create the complete implementation contract for authorized Playwright work. This skill plans only.

## Inputs

- concrete requirement and acceptance criteria;
- `playwrightImpactAnalysis`;
- `playwrightAuthoringDecision`;
- repository context;
- optional Comet/OpenSpec design context.

If authoring is disabled, return a no-op plan.

## Required planning work

For every non-ignored target:

1. classify the boundary as `business-e2e`, `frontend-integration`, `component`, `api-contract`, `infrastructure-self-test`, or `example`;
2. identify the real route or execution entry;
3. identify production source paths;
4. identify fixtures, Page Objects, helpers, API clients, selectors, and data to reuse;
5. choose the smallest correct asset change;
6. map required behavior and branches to assertions;
7. define deterministic fixture, authentication, feature-flag, clock, and network strategy;
8. list expected evidence and verification commands.

For existing product behavior, use the real application boundary. Do not plan generated HTML or test-side replacements of the feature.

Do not add targets absent from the confirmed decision.

## Required output

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

Complete only when every confirmed target has a concrete plan, every acceptance criterion maps to assertions, and the Build skill can proceed without guessing scope.
