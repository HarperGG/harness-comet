---
name: playwright-planner
description: Plan Playwright test assets from a concrete requirement by inspecting the real application boundary and selecting verify, update, create, or none under the journeys/incidents/data/support model.
---

# Playwright Planner

## Activation contract

Use this skill when the user asks to plan Playwright coverage or when `playwright-authoring` delegates planning.

This skill is planning-only. Do not create, update, delete, or retire test assets.

## Responsibility

Turn a concrete requirement, bug report, acceptance criterion, or user workflow into a repository-grounded Playwright plan that the generator and healer can execute without guessing.

When `.agents/playwright.md` exists, read it and apply its default testing obligation and exemptions.

## Required inspection

Inspect, when present:

```text
package.json
.agents/playwright.md
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

Use the project's package manager when it is not pnpm.

Search existing `*.spec.*` files by business behavior, real route, production implementation, API, fixture, Page Object, helper, tag, incident ID, imports, and changed source dependencies. Filename or keyword similarity alone is not proof of coverage; read plausible candidates and explain the relationship.

## Required test action

Select exactly one:

- `verify`: an existing test directly proves the changed behavior and will be executed;
- `update`: existing coverage is related but lacks a required step, branch, input, or assertion;
- `create`: no existing test directly proves the behavior;
- `none`: only an explicit exemption in `.agents/playwright.md` applies.

Do not select `none` because the change is small, the user did not request tests, coverage might exist, tests are difficult, or execution is slow.

Feature work and bug fixes default to `update` or `create` unless direct existing coverage supports `verify`.

## Playwright asset placement model

Resolve the configured Playwright test directory:

1. prefer `harness-comet.config.ts` `playwright.testDir` when present;
2. otherwise use `playwright.config.ts` `testDir` when statically clear;
3. otherwise use `tests`.

Plan assets under:

```text
<testDir>/
  journeys/    Core long-lived business journeys
  incidents/   Bug, production issue, and incident regressions
  data/        Fixed input, expected output, and deterministic JSON data
  support/     Fixtures, mocks, selectors, assertions, factories, and helpers
```

Create only the asset types needed by the requirement.

## Placement contract

- Long-lived core business specs go under `<testDir>/journeys/`.
- Bug and production regressions go under `<testDir>/incidents/`.
- Fixed input, expected output, captured contracts, and deterministic JSON go under `<testDir>/data/`.
- Reusable fixtures, mocks, selectors, assertions, API clients, factories, and helpers go under `<testDir>/support/`.
- Fixed case data does not go in `support/`.
- Helper code does not go in `data/`.
- Tests exercise the real application boundary; do not plan generated HTML or a test-only replacement for the product.

## Required output

```yaml
playwrightPlan:
  requirement: ...
  action: verify | update | create | none
  actionReason: ...
  exemption: null
  testDir: tests
  classification:
    boundary: business-e2e | frontend-integration | component | api-contract | infrastructure-self-test | example
    assetIntent: journey | incident | data-only | support-only | mixed | none
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

For `update` or `create`, at least one concrete spec target must be declared unless the requirement is explicitly data-only or support-only. For `verify`, every target must already exist and include evidence of direct coverage. For `none`, `exemption` is required and all planned asset arrays must be empty.
