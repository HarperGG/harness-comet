---
name: playwright-planner
description: Plan Playwright test assets from a concrete requirement by exploring the real application boundary and selecting the correct journeys/incidents/data/support asset placement.
---

# Playwright Planner

## Activation contract

Use this skill when the user asks to plan Playwright coverage, generate a Playwright test plan, or when `playwright-authoring` delegates its planning phase.

This skill is planning-only. Do not create, update, delete, or retire test assets.

## Responsibility

Turn a concrete requirement, bug report, acceptance criterion, or user workflow into a repository-grounded Playwright asset plan.

The plan must say which assets are needed. It must not require all asset types for every test.

## Required inspection

Inspect, when present:

```text
package.json
harness-comet.config.ts
playwright.config.ts
configured Playwright test directories
relevant application routes, components, stores, APIs, serializers, and feature flags
existing Playwright specs, fixtures, Page Objects, helpers, support utilities, and test data
```

Run when available:

```bash
pnpm exec playwright test --list
```

Search existing `*.spec.*` files by business behavior, route, production implementation, API, fixture, Page Object, helper, tag, incident ID, imports, and changed source dependencies.

Do not rely on filename or keyword similarity alone. Read plausible candidates and describe the relationship.

## Playwright asset placement model

Resolve the configured Playwright test directory before planning assets:

1. prefer `harness-comet.config.ts` `playwright.testDir` when present;
2. otherwise prefer `playwright.config.ts` `testDir` when it is statically clear;
3. otherwise use `tests`.

When an asset of a given type is needed, plan it under the matching directory in `<testDir>`:

```text
<testDir>/
  journeys/    Core long-lived business journeys
  incidents/   Production issue and incident regressions
  data/        Fixed input, expected output, and deterministic JSON data
  support/     Mock, attachment, request capture, canvas, assertion, and helper utilities
```

A requirement does not need to create all four kinds of assets. Plan only the files needed to satisfy the requirement and keep each planned file in the correct location.

## Asset classification

Classify the target as exactly one of:

- `business-e2e`;
- `frontend-integration`;
- `component`;
- `api-contract`;
- `infrastructure-self-test`;
- `example`.

Classify the asset intent as exactly one of:

- `journey`: long-lived core business path;
- `incident`: production issue or incident regression;
- `data-only`: fixed input or expected output asset only;
- `support-only`: reusable helper/mock/assertion/attachment capability only;
- `mixed`: spec plus data/support assets.

## Placement contract

- Put long-lived core business journey specs under `<testDir>/journeys/`.
- Put production incident regressions under `<testDir>/incidents/`.
- Put fixed input JSON, expected payload JSON, captured API contracts, scenario data, and deterministic test data under `<testDir>/data/`.
- Put mock helpers, attachment helpers, request capture helpers, canvas helpers, custom assertions, API test clients, selectors, factories, and reusable utilities under `<testDir>/support/`.
- Do not place fixed case data in `support/`.
- Do not place helper code in `data/`.
- Do not place incident-only regressions in `journeys/` unless the requirement explicitly promotes the incident into a long-lived core journey.
- Do not create a generated HTML replacement for the product. Tests must exercise the real application boundary unless the requirement is explicitly an infrastructure self-test or example.

## Required output

Write the plan into the current authoring session document or return it to the caller in this shape:

```yaml
playwrightPlan:
  requirement: ...
  testDir: tests
  classification:
    boundary: business-e2e | frontend-integration | component | api-contract | infrastructure-self-test | example
    assetIntent: journey | incident | data-only | support-only | mixed
  repositoryInspection:
    routes: []
    productionSources: []
    existingSpecs: []
    reusableAssets: []
  requirementCoverage:
    - requirement: ...
      assertions: []
  plannedAssets:
    specs: []
    data: []
    support: []
    docs: []
  fixtureAndNetworkStrategy: []
  evidence: []
  verificationCommands: []
  blockers: []
```

Every `plannedAssets` path must comply with the placement contract, or the plan must explicitly explain the project-specific configured Playwright path that overrides the default model.
