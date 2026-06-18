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

Explicit invocation may look different across agents. Examples include:

```text
@harness-comet-playwright-authoring
<concrete requirement>
```

```text
/harness-comet-playwright-authoring
<concrete requirement>
```

```text
Use the harness-comet-playwright-authoring skill.
<concrete requirement>
```

```text
Select “Harness-Comet Playwright Authoring” from the host agent's skill, command, prompt, or tool picker, then provide the requirement.
```

The literal `@harness-comet-playwright-authoring` syntax is an optional convention, not a universal requirement.

Valid example:

```text
Use the harness-comet-playwright-authoring skill.

保存按钮点击后显示确认弹窗。确认后发送保存请求；取消后不得发送请求，并保持未保存状态。
```

Do not activate this skill when:

- the host agent inferred it only from topic similarity;
- the user only asks a general Playwright question;
- the user asks what this skill does;
- the user asks to review, explain, or discuss testing strategy without explicitly selecting or naming the skill;
- the user mentions Harness-Comet, Playwright, fixtures, mocks, reporters, or incidents in ordinary conversation;
- the requirement is absent or too vague to identify a testable behavior;
- repository-level instructions merely advertise or reference the skill without the user choosing it for the current task.

If the user explicitly invokes the skill but provides no concrete requirement, ask for exactly one concrete requirement. Do not inspect or modify the repository before that requirement is available.

## Single Responsibility

This skill has one responsibility:

> Given one explicit requirement, generate the complete Playwright test assets required to verify it in the current project's architecture and Harness-Comet conventions.

This skill does not:

- provide general Playwright education;
- perform broad test-suite reviews;
- redesign the project's test architecture;
- create unrelated refactors;
- add speculative coverage not required by the stated behavior;
- modify production code unless a missing testability hook blocks the requested test and the user explicitly permits that change;
- generate generic example code that is not integrated into the repository;
- stop after producing only a plan, snippet, skeleton, TODO, or pseudo-code when implementation was requested.

## Scope Discipline

Treat the user's requirement as the scope boundary.

Generate only the assets necessary to verify:

- the required preconditions;
- the required user actions;
- the required successful outcome;
- explicitly stated negative, cancellation, permission, or error behavior;
- necessary persistence, network, or state effects.

Do not add unrelated cases such as accessibility, performance, multiple browsers, mobile layouts, localization, permissions, retries, or visual snapshots unless:

1. they are explicitly part of the requirement; or
2. the repository's existing Harness-Comet convention makes them mandatory.

Do not omit an explicitly stated branch merely to keep the implementation short.

## Definition of a Complete Result

A generated result is complete only when it includes all applicable assets required by the repository, such as:

- one or more executable `*.spec.ts` files;
- updates to an existing spec when that is the correct architectural choice;
- deterministic fixture or input data;
- expected payload or expected result data;
- route/network setup when external dependencies must be controlled;
- use of existing project fixtures, Page Objects, helpers, and test extensions;
- Harness-Comet tags and directory placement;
- incident assets when the requirement explicitly identifies an escaped defect or incident;
- structured evidence attachments when required by existing conventions;
- validation and execution results.

Do not create a file merely to satisfy a checklist. Reuse existing assets when they already represent the required state.

## Required Workflow

### 1. Parse the explicit requirement

Extract only what the user stated or what is strictly implied by the stated behavior:

- start state;
- actor;
- action;
- expected visible result;
- expected state, request, persistence, or navigation effect;
- explicitly required negative paths;
- named route, component, API, issue ID, or existing test;
- acceptance criteria.

Create a requirement checklist before editing.

Example:

```text
Requirement checklist
- Save opens a confirmation dialog.
- Confirm sends exactly one save request.
- The request payload matches the edited annotation.
- Cancel sends no save request.
- Cancel preserves the unsaved editor state.
```

Every checklist item must map to at least one test assertion.

### 2. Inspect the current repository

Before writing files, read the relevant project configuration and nearby implementation.

Required inspection:

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
```

If supported, also run:

```bash
pnpm exec harness-comet --json context
```

Inspect and reuse:

- `baseURL` and `webServer`;
- configured browser projects;
- authentication or `storageState` setup;
- custom fixtures and `test.extend`;
- Page Objects;
- API helpers;
- route interception conventions;
- fixture factories and JSON data;
- selector conventions;
- existing tags;
- reporters and Harness result paths;
- lint, type-check, and test commands.

Do not invent a selector, route, helper, fixture shape, or API contract before inspecting the repository.

### 3. Select the smallest correct asset change

Choose one:

#### Update an existing test

Use when the existing journey already represents the same business promise and the requirement adds or changes a branch within it.

#### Create a new journey

Use when the requirement represents a distinct independently runnable business promise.

#### Create an incident regression

Use only when the user explicitly identifies a bug, incident, issue ID, or escaped regression whose exact reproduction should be preserved.

Do not create a new abstraction or folder when the existing project layout already has an appropriate location.

### 4. Produce a bounded implementation plan

Before editing, state:

```text
Requirement coverage
Existing assets to reuse
Files to create
Files to update
Test cases and assertions
Fixture/network strategy
Verification commands
```

The plan must be specific, not generic.

Do not add optional suggestions or future improvements to the implementation scope.

When the user explicitly invoked this skill to generate assets, continue from the plan into implementation without requiring another confirmation unless a material ambiguity prevents a correct test.

### 5. Build deterministic setup

Use the project's existing setup style.

Preference order:

1. existing fixture, factory, or test extension;
2. existing Page Object or helper;
3. small explicit fixture data;
4. existing API/network helper;
5. exact Playwright route interception;
6. real test backend when the requirement specifically verifies backend integration.

Network interception is optional, not a default requirement.

Use it only to control an external dependency or capture a request without replacing the core behavior being tested.

Do not mock the behavior under test.

Examples:

- To test a confirmation dialog, the backend response may be controlled while the real UI confirmation logic remains active.
- To test request serialization, capture the real outgoing request payload; do not replace the serializer with expected data.
- To test full frontend-backend integration, use the real test backend rather than intercepting the target API.

Use deterministic data. Do not depend on production data, random values, current dates, or shared mutable environment state unless the project already provides a deterministic abstraction.

### 6. Write project-consistent Playwright tests

Use the project's existing import style, fixtures, helpers, and naming conventions.

Locator preference unless the repository establishes another convention:

1. `getByRole`;
2. `getByLabel`;
3. `getByPlaceholder`;
4. project semantic helper or Page Object;
5. `getByTestId`;
6. stable CSS only when no semantic selector exists.

Never use generated class names, DOM-depth selectors, or incidental styling.

Use Playwright auto-waiting and web-first assertions.

Never add:

```ts
page.waitForTimeout(...)
```

Wait for observable readiness such as:

- expected route;
- visible ready state;
- enabled control;
- completed request;
- rendered application data;
- stable project-provided test bridge state.

### 7. Satisfy Harness-Comet requirements

Every generated Harness test must include `@harness`.

Example:

```ts
test(
  "confirming save submits the edited annotation",
  {
    tag: ["@harness", "@annotation", "@save"]
  },
  async ({ page }, testInfo) => {
    // complete test implementation
  }
);
```

Reuse existing domain tags before creating new tags.

Use `@critical`, `@smoke`, or `@incident` only when justified by the requirement or existing project convention.

Preserve existing Harness-Comet reporter configuration and result generation. Do not replace or remove configured reporters.

Place assets in the existing configured locations for:

- journeys;
- incidents;
- test data;
- support helpers;
- expected results;
- evidence.

### 8. Implement complete assertions

Map every requirement checklist item to a concrete assertion.

Use all applicable assertion layers.

#### Visible behavior

Examples:

- dialog appears;
- success state is displayed;
- error state is accessible;
- route changes;
- editor remains dirty;
- control becomes enabled or disabled.

#### State or integration behavior

Examples:

- request is sent exactly once;
- request is not sent;
- request payload matches expected data;
- persisted result is rendered;
- state transition matches the requirement;
- navigation reaches the expected destination.

#### Evidence

Attach structured evidence only when it is useful or required by project convention:

```ts
await testInfo.attach("save-request", {
  body: JSON.stringify(payload, null, 2),
  contentType: "application/json"
});
```

Never include secrets, tokens, credentials, or unrelated large data.

### 9. Prove negative behavior

When the requirement says something must not happen, directly prove it did not happen.

For example, cancellation is not fully tested by asserting that a dialog closes. Also verify that:

- no save request was sent;
- no navigation occurred, when applicable;
- no persisted state changed;
- required unsaved state remains.

Do not replace explicit negative verification with a weak visibility-only assertion.

### 10. Validate the produced assets

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

When the repository provides them, also run:

```bash
pnpm exec eslint <changed-files>
pnpm exec tsc --noEmit
```

When a dedicated command exists, use:

```bash
pnpm exec harness-comet authoring verify \
  --files <changed-test-files> \
  --run
```

Do not claim completion when the files were not collected by Playwright.

Do not claim a passing result when execution did not run or failed.

### 11. Repair only the generated scope

If validation or the target test fails:

1. inspect the error and Playwright call log;
2. inspect `error-context.md`, screenshots, trace, or request logs when available;
3. identify the smallest incorrect assumption;
4. repair only the files within the requirement scope;
5. rerun the target test;
6. rerun Harness-Comet validation.

Do not weaken a required assertion to force a pass.

Do not add sleeps.

Do not expand into unrelated production refactors.

## Required Final Report

The final response must be complete and factual.

Use this structure:

### Requirement coverage

List every original requirement and the test assertion or case that covers it.

### Assets created or updated

List exact repository paths and their purpose.

### Architecture reused

List existing fixtures, helpers, Page Objects, authentication setup, selectors, or test conventions that were reused.

### Verification results

List exact commands executed and their actual results:

- Harness-Comet validation;
- Playwright collection;
- target test execution;
- lint/type-check when run;
- generated report/result locations.

### Not completed

List any requirement that could not be implemented or executed, with the exact reason.

Do not include broad future recommendations, optional enhancements, or unrelated test ideas unless the user requests them.

## Completion Gate

Do not mark the task complete unless every applicable condition is satisfied:

- [ ] The user explicitly selected, invoked, or named this skill through the current host agent.
- [ ] A concrete requirement accompanied the invocation.
- [ ] Every stated acceptance criterion appears in the requirement checklist.
- [ ] Existing Playwright and Harness-Comet architecture was inspected.
- [ ] The smallest correct existing asset boundary was selected.
- [ ] Existing helpers, fixtures, Page Objects, and selectors were reused where appropriate.
- [ ] Every generated Harness test includes `@harness`.
- [ ] No `page.waitForTimeout` was added.
- [ ] No production URL or production data was used.
- [ ] Test data is deterministic.
- [ ] Every checklist item maps to an explicit assertion.
- [ ] Persistence or save behavior verifies payload or persisted result when applicable.
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
- a partial happy-path test when negative behavior was explicitly required;
- a summary claiming success without validation evidence.
