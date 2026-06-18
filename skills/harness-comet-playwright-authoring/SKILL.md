---
name: harness-comet-playwright-authoring
description: Use only when the user explicitly selects, invokes, or names this skill through the host agent's supported mechanism and provides a concrete requirement. Generate complete, project-consistent Playwright tests and required Harness-Comet assets for that requirement. Never activate implicitly, never broaden the requested scope, and never return a partial or example-only implementation.
---

# Harness-Comet Playwright Authoring

## Activation Contract

This skill is **explicit-invocation only**.

Activate it only when both conditions are true:

1. The user explicitly selects, invokes, or names this skill using a mechanism supported by the current host agent.
2. The same request includes a concrete requirement, bug description, acceptance criterion, or user workflow to implement.

Valid invocation examples:

```text
@harness-comet-playwright-authoring
<concrete requirement>
```

```text
Use the harness-comet-playwright-authoring skill.
<concrete requirement>
```

Do not activate this skill when:

- the host agent inferred it only from topic similarity;
- the user only asks a general Playwright question;
- the user asks what this skill does;
- the user asks to review or discuss testing strategy without explicitly invoking the skill;
- the requirement is absent or too vague to identify testable behavior.

If the user explicitly invokes the skill but provides no concrete requirement, ask for exactly one concrete requirement. Do not inspect or modify the repository before that requirement is available.

## Single Responsibility

Given one explicit requirement, generate the complete Playwright test assets required to verify it in the current project's architecture and Harness-Comet conventions.

This skill does not:

- provide general Playwright education;
- perform broad test-suite reviews;
- redesign the project's test architecture;
- create unrelated refactors;
- add speculative coverage not required by the stated behavior;
- modify production code unless a missing testability hook blocks the requested test and the user explicitly permits that change;
- generate generic example code that is not integrated into the repository;
- stop after producing only a plan, snippet, skeleton, TODO, or pseudo-code when implementation was requested.

## Core Testing Principle

> For an existing product feature, test the real implementation. Mock dependencies, never the feature itself.

A passing test is not sufficient when it only verifies HTML, client logic, payload construction, or state transitions authored inside the test.

## Scope Discipline

Treat the user's requirement as the scope boundary.

Generate only the assets necessary to verify:

- required preconditions;
- required user actions;
- required successful outcomes;
- explicitly stated negative, cancellation, permission, or error behavior;
- necessary persistence, network, or state effects.

Do not add unrelated accessibility, performance, browser-matrix, mobile, localization, retry, or visual-snapshot cases unless they are explicitly required or mandatory in the repository.

Every stated branch must map to at least one assertion.

## Definition of a Complete Result

A generated result is complete only when it includes all applicable repository-integrated assets, such as:

- executable `*.spec.ts` files;
- updates to an existing spec when architecturally correct;
- deterministic fixtures or input data;
- expected payload or result data;
- route or network setup for external dependencies;
- existing fixtures, Page Objects, helpers, and test extensions;
- Harness-Comet tags and configured directory placement;
- incident assets when the requirement identifies an escaped defect;
- structured evidence when required by repository convention;
- actual validation and execution results.

Do not create files merely to satisfy a checklist. Reuse existing assets when they represent the required state and preserve the correct test boundary.

## Real Application Boundary

For any requirement that names or implies an existing product page, route, component, workflow, feature, form, dialog, editor, table, button, or other user-visible behavior, the default boundary is the **real application implementation**.

The generated test must load and exercise the project's actual application code through one of the project's configured mechanisms:

- `page.goto()` using the configured `baseURL`;
- an existing Playwright `webServer`;
- an existing application fixture;
- the repository's established component-testing setup, only when component testing is explicitly required.

The test may mock or intercept external dependencies, backend APIs, authentication, time, feature flags, or deterministic data when necessary. It must not replace the application behavior being verified.

For a business UI requirement, never create a substitute page or duplicate the feature implementation inside the spec.

Unless the user explicitly requests a synthetic harness, framework demonstration, or infrastructure self-test, do not use:

- `page.setContent(...)`;
- `page.goto("data:text/html,...")`;
- `page.goto("about:blank")` followed by DOM construction;
- route interception that fulfills the main document with generated HTML;
- inline `<script>` code that reimplements the product interaction;
- a test-only HTML page that duplicates an existing production page;
- mock components that replace the component or workflow under test.

A test that verifies test-authored HTML or test-authored client behavior does not count as verification of an existing product requirement.

## Required Workflow

### 1. Parse the explicit requirement

Extract only what the user stated or what is strictly implied:

- start state;
- actor;
- action;
- expected visible result;
- expected state, request, persistence, or navigation effect;
- explicitly required negative paths;
- named route, component, API, issue ID, or existing test;
- acceptance criteria.

Create a requirement checklist before editing. Every checklist item must map to at least one concrete assertion.

### 2. Classify the test boundary

Classify the requirement as exactly one of:

1. business end-to-end workflow;
2. frontend integration workflow;
3. component test;
4. API or serialization contract test;
5. Harness-Comet or Playwright infrastructure self-test;
6. example or demonstration.

Default to `business end-to-end workflow` when the requirement refers to an existing product page, route, feature, component, button, dialog, form, or user workflow.

Do not downgrade a business end-to-end requirement to a synthetic contract test merely because an existing example uses generated HTML.

State the selected classification and implementation boundary in the plan.

### 3. Inspect the current repository

Before writing files, inspect:

```text
package.json
harness-comet.config.ts
playwright.config.ts
existing tests under the configured test directory
relevant application route/component/API/state code
```

When available, run:

```bash
pnpm exec harness-comet --json validate
pnpm exec harness-comet tests list
pnpm exec playwright test --list
pnpm exec harness-comet --json context
```

Inspect and reuse when appropriate:

- `baseURL` and `webServer`;
- configured browser projects;
- authentication or `storageState` setup;
- custom fixtures and `test.extend`;
- Page Objects;
- API helpers;
- fixture factories and JSON data;
- selector conventions;
- existing tags;
- reporters and Harness result paths;
- lint, type-check, and test commands.

For a business application test, identify before implementation:

- the real route to open;
- the route registration or navigation entry;
- the production page or component implementing the behavior;
- the production API client or endpoint used by the page;
- authentication, store, feature-flag, or environment prerequisites.

Record exact repository paths in the implementation plan.

Do not invent selectors, routes, helpers, fixture shapes, or API contracts before inspection.

If the real route or implementation cannot be located, do not create a synthetic substitute. Inspect further or report the exact missing prerequisite.

### 4. Evaluate existing tests correctly

Existing tests are evidence, not absolute authority.

Classify nearby tests before copying their structure:

- real application test;
- infrastructure self-test;
- demo or example;
- contract-only test;
- legacy pattern.

Reuse an existing convention only when it preserves the correct implementation boundary for the stated requirement.

Do not copy a synthetic, demo, contract-only, or infrastructure-test pattern into a business E2E test.

When an existing test conflicts with the requirement or the real-application boundary, follow the requirement and the production architecture instead.

### 5. Select the smallest correct asset change

Choose one:

- update an existing journey when it already represents the same business promise;
- create a new journey for a distinct independently runnable business promise;
- create an incident regression only when the user explicitly identifies a bug, issue, incident, or escaped regression.

"Smallest correct" means the smallest change that verifies the real requirement against the correct implementation boundary.

It does not mean:

- the shortest test;
- the easiest test to make pass;
- the most isolated synthetic reproduction;
- replacing the application with inline HTML;
- reducing an E2E workflow to a contract simulation.

Do not create a new abstraction or folder when an appropriate project location already exists.

### 6. Produce a bounded implementation plan

Before editing, state:

```text
Requirement coverage
Test classification and implementation boundary
Real route and production source paths
Existing assets to reuse
Files to create
Files to update
Test cases and assertions
Fixture/network strategy
Verification commands
```

The plan must be specific. Do not add optional suggestions or future improvements.

Continue from plan to implementation without requesting another confirmation unless a material ambiguity prevents a correct test.

### 7. Build deterministic setup

Use existing setup patterns only when they preserve the correct test boundary.

Preference order:

1. existing fixture, factory, or test extension;
2. existing Page Object or helper;
3. small explicit fixture data;
4. existing API/network helper;
5. exact Playwright route interception;
6. real test backend when backend integration is part of the requirement.

Network interception is optional. Use it to control dependencies or capture requests without replacing the behavior under test.

Allowed:

- mock backend responses consumed by the real page;
- seed deterministic data;
- capture a real outgoing request;
- simulate backend errors;
- stub unrelated external services.

Not allowed for an existing product workflow:

- return generated HTML for the application page;
- implement the dialog, form, table, editor, or workflow inside the test;
- construct the target request payload in test-side page JavaScript;
- bypass the production API client or serializer when it is part of the requirement;
- assert against a request emitted by test-authored client code.

Do not mock the behavior under test.

Use deterministic data. Do not depend on production data, random values, current dates, or shared mutable state unless the project already provides a deterministic abstraction.

### 8. Write project-consistent Playwright tests

Use the project's existing import style, fixtures, helpers, naming, and selector conventions when they preserve the correct boundary.

Locator preference unless the repository establishes another convention:

1. `getByRole`;
2. `getByLabel`;
3. `getByPlaceholder`;
4. project semantic helper or Page Object;
5. `getByTestId`;
6. stable CSS only when no semantic selector exists.

Never use generated class names, DOM-depth selectors, or incidental styling.

Use Playwright auto-waiting and web-first assertions. Never add `page.waitForTimeout(...)`.

Wait for observable readiness such as:

- expected route;
- visible ready state;
- enabled control;
- completed request;
- rendered application data;
- stable project-provided test bridge state.

### 9. Satisfy Harness-Comet requirements

Every generated Harness test must include `@harness`.

Reuse existing domain tags before creating new tags. Use `@critical`, `@smoke`, or `@incident` only when justified.

Preserve existing Harness-Comet reporter configuration and result generation.

Place assets in configured locations for journeys, incidents, test data, support helpers, expected results, and evidence.

### 10. Implement complete assertions

Map every requirement checklist item to a concrete assertion.

Use applicable assertion layers:

- visible behavior;
- route or navigation behavior;
- state transitions;
- request count;
- request absence;
- real outgoing payload;
- persisted result;
- error or cancellation behavior.

For negative behavior, directly prove the forbidden effect did not occur. Closing a dialog alone does not prove that no request, navigation, persistence, or state mutation occurred.

Attach structured evidence only when useful or required. Never attach secrets, credentials, tokens, or unrelated large data.

### 11. Prove production-code coverage

For a business workflow, confirm that the test:

- navigates to the real application route;
- loads the configured application server;
- interacts with DOM rendered by production components;
- exercises the relevant production handler, store action, serializer, or API client;
- does not fulfill the main document with test-generated HTML;
- does not duplicate the production UI or client behavior inside the spec.

Include the real route and relevant production source paths in the final report.

A passing test does not prove the requirement when the named production implementation was not executed.

### 12. Validate the produced assets

Run all applicable deterministic checks.

Required:

```bash
pnpm exec harness-comet validate
pnpm exec harness-comet tests list
pnpm exec playwright test --list
```

Run every created or materially changed test file:

```bash
pnpm exec harness-comet run -- <changed-test-file>
```

When available, also run:

```bash
pnpm exec eslint <changed-files>
pnpm exec tsc --noEmit
```

When supported, prefer:

```bash
pnpm exec harness-comet authoring verify \
  --files <changed-test-files> \
  --run
```

Do not claim completion when Playwright did not collect the files. Do not claim a passing result when execution did not run or failed.

### 13. Repair only the generated scope

If validation or the target test fails:

1. inspect the error and Playwright call log;
2. inspect `error-context.md`, screenshots, trace, or request logs when available;
3. identify the smallest incorrect assumption;
4. repair only files within the requirement scope;
5. rerun the target test;
6. rerun Harness-Comet validation.

Do not weaken required assertions, add sleeps, replace the real application with a synthetic page, or expand into unrelated production refactors.

## Required Final Report

Use this structure:

### Requirement coverage

List every original requirement and the assertion or test case that covers it.

### Test boundary

State the test classification, real application route, and production source paths exercised.

### Assets created or updated

List exact repository paths and their purpose.

### Architecture reused

List existing fixtures, helpers, Page Objects, authentication setup, selectors, application server setup, and conventions reused.

### Verification results

List exact commands executed and actual results:

- Harness-Comet validation;
- Playwright collection;
- target test execution;
- lint or type-check when run;
- generated report and result locations.

### Not completed

List any requirement that could not be implemented or executed, with the exact reason.

Do not include broad future recommendations or unrelated test ideas unless the user requests them.

## Completion Gate

Do not mark the task complete unless every applicable condition is satisfied:

- [ ] The user explicitly invoked this skill and supplied a concrete requirement.
- [ ] Every acceptance criterion appears in the requirement checklist.
- [ ] The test type and implementation boundary were explicitly classified.
- [ ] Existing Playwright and Harness-Comet architecture was inspected.
- [ ] For a business workflow, the real route and implementing production source files were identified.
- [ ] A business workflow loads the real project application.
- [ ] The main document is not replaced with generated test HTML.
- [ ] The spec does not duplicate the production UI or client behavior.
- [ ] Mocks control dependencies only; they do not implement the behavior under test.
- [ ] Existing example tests were classified before their structure was copied.
- [ ] The smallest correct asset boundary was selected.
- [ ] Existing helpers, fixtures, Page Objects, and selectors were reused where appropriate.
- [ ] Every generated Harness test includes `@harness`.
- [ ] No `page.waitForTimeout` was added.
- [ ] No production URL or production data was used.
- [ ] Test data is deterministic.
- [ ] Every checklist item maps to an explicit assertion.
- [ ] Persistence or save behavior verifies the real outgoing payload or persisted result when applicable.
- [ ] Negative requirements prove the forbidden effect did not occur.
- [ ] Existing reporters and Harness result generation remain intact.
- [ ] Every changed test is collected by Playwright.
- [ ] Harness-Comet validation passes.
- [ ] Every created or materially changed test was executed unless execution was impossible.
- [ ] Any failed or impossible verification is reported honestly.

## Prohibited Outputs

Never return only:

- a generic Playwright example;
- a test skeleton;
- pseudo-code;
- a list of suggested cases without implementation;
- TODO placeholders;
- invented selectors or endpoints;
- a partial happy-path test when negative behavior was required;
- a summary claiming success without validation evidence.

For existing product functionality, never produce:

- a spec that constructs its own replacement HTML page;
- a spec that fulfills the application document with inline HTML;
- a spec that reimplements the product's JavaScript behavior;
- a fake form, dialog, table, editor, or button standing in for an existing component;
- a test that validates only a fabricated payload flow while claiming to cover the real product workflow;
- a synthetic page merely because another example spec uses that approach.
