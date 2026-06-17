---
name: harness-comet-playwright-authoring
description: Use when a user asks to create, update, review, or repair Playwright tests and Harness-Comet assets from a feature requirement, bug report, acceptance criteria, manual QA flow, or code change. The skill must study the existing project architecture, reuse local test conventions, produce a coverage plan before editing, create complete deterministic Playwright assets, and verify the result with Harness-Comet.
---

# Harness-Comet Playwright Authoring

## Purpose

Turn one concrete product requirement or regression into project-consistent, executable Playwright tests and Harness-Comet assets.

The result must not be a generic example test. It must fit the repository's existing:

- application routes and startup model;
- authentication strategy;
- Playwright configuration;
- fixtures and test extensions;
- Page Objects and helpers;
- API mocking style;
- selector conventions;
- Harness test directories and tags;
- incident and evidence conventions;
- lint, type-check, and CI commands.

## Use This Skill When

Use this skill for requests such as:

- add Playwright coverage for a new feature;
- convert acceptance criteria into tests;
- automate a manual QA workflow;
- create a regression test for a bug;
- update existing tests after a behavior change;
- generate fixtures, mocks, expected payloads, attachments, or incident assets;
- repair an AI-generated Playwright test that does not satisfy Harness-Comet;
- review whether existing tests fully cover a requirement.

Do not use this skill for unit tests, pure component tests, load tests, or production implementation unless they are necessary to make the Playwright test observable and the user permits the change.

## Core Rules

1. Inspect before editing.
2. Prefer existing project patterns over introducing new abstractions.
3. Produce a compact coverage plan before writing files.
4. Prefer updating an existing journey when the behavior belongs to it.
5. Create a new journey only for a distinct business promise or regression risk.
6. Every generated Harness test must include `@harness`.
7. Do not use `page.waitForTimeout`.
8. Do not access production URLs or production data.
9. Use stable fixtures and deterministic mocks.
10. Assert business outcomes, not only element visibility.
11. Save workflows must assert the outgoing payload or persisted result.
12. Negative workflows must prove the forbidden action did not occur.
13. Reuse project helpers, fixtures, Page Objects, and selector conventions.
14. Run deterministic validation after writing files.
15. Do not declare success unless the generated test is collected and the requested verification passes.

## Workflow

### 1. Read the requirement

Extract:

- the user-visible behavior;
- preconditions;
- primary action;
- expected outcome;
- negative or cancellation behavior;
- business risk if the behavior regresses;
- explicit acceptance criteria;
- relevant code or routes named by the user.

Reduce broad requirements into a small number of durable business promises.

Do not generate one test for every sentence. Group assertions that belong to the same user workflow.

### 2. Discover Harness-Comet and Playwright configuration

Run, when available:

```bash
pnpm exec harness-comet --json validate
pnpm exec harness-comet tests list
pnpm exec playwright test --list
```

Read:

```text
harness-comet.config.ts
playwright.config.ts
package.json
```

Identify:

- Playwright test directory;
- configured projects and browsers;
- `baseURL` and `webServer`;
- retries and timeouts;
- reporters;
- authentication/storage-state setup;
- Harness results and incident directories;
- required tags and validation rules.

If a machine-readable Harness context command exists, prefer it:

```bash
pnpm exec harness-comet --json context
```

Do not assume this command exists. Fall back to repository inspection.

### 3. Inspect the project test architecture

Search the test directory before creating anything.

Find:

- tests nearest to the affected feature;
- fixtures and custom `test.extend` definitions;
- Page Objects;
- mock helpers;
- attachment helpers;
- fixture JSON files;
- test-data factories;
- authentication setup;
- route interception patterns;
- selector patterns;
- common tags;
- incident layouts;
- result and evidence conventions.

Also inspect the relevant application code:

- route component;
- form or dialog component;
- API client;
- state store;
- serializer/deserializer;
- feature flag;
- `data-testid`, accessible role, label, or text hooks.

Do not invent selectors before checking the UI implementation.

### 4. Decide whether to update or create

Prefer **update existing** when:

- an existing journey already covers the same business promise;
- the requirement adds a branch to an existing workflow;
- the existing helper or fixture is the natural home for the change.

Prefer **create new** when:

- the requirement represents a distinct business promise;
- the regression needs an independently runnable test;
- the workflow has different setup, data, or risk;
- adding it to an existing test would create a kitchen-sink scenario.

Prefer an **incident asset** when:

- the request is a real production or escaped defect;
- there is an issue ID or external issue URL;
- preserving the exact reproduction data is important.

### 5. Produce a test plan before editing

Present a compact plan containing:

```text
Requirement
Existing relevant assets
Coverage decision: update | create | incident
Test cases
Fixtures and mocks
Business assertions
Files to create
Files to update
Verification commands
Risks or missing test hooks
```

Each proposed test case must include:

- title;
- tags;
- preconditions;
- user actions;
- business assertions;
- network or persistence assertions;
- expected evidence.

When the user explicitly asked for implementation, proceed after producing the plan. When the user asked only for a plan or review, do not edit files.

### 6. Design deterministic data and setup

Prefer this order:

1. Existing local fixture or factory.
2. Small explicit JSON fixture.
3. Existing API mock helper.
4. `page.route` or `browserContext.route` with exact request handling.
5. Dedicated test environment when mocks would hide the behavior being tested.

Keep fixture data minimal and named after the business state, for example:

```text
tests/data/annotation-draft-with-cuboid.json
tests/data/expected-cuboid-save-payload.json
```

Do not create giant catch-all fixtures.

Do not over-mock. Preserve the real layer that the requirement is meant to verify.

Examples:

- UI confirmation behavior: mock backend responses, keep real UI and state logic.
- Request serialization regression: capture and assert the real outgoing request payload.
- Navigation regression: use the real router and destination page.
- Backend integration requirement: do not mock the backend call unless the test contract explicitly permits it.

### 7. Write resilient Playwright tests

Locator preference:

1. `getByRole`
2. `getByLabel`
3. `getByPlaceholder`
4. project-standard semantic helpers
5. `getByTestId`
6. CSS locator only when no stable semantic locator exists

Do not use brittle selectors based on generated class names, DOM depth, or incidental styling.

Use Playwright auto-waiting and web-first assertions:

```ts
await expect(locator).toBeVisible();
await expect(locator).toHaveText("Saved");
await expect.poll(readBusinessState).toEqual(expected);
```

Do not use:

```ts
await page.waitForTimeout(...);
```

For asynchronous application readiness, wait for an observable condition:

- visible ready state;
- completed network response;
- enabled control;
- stable store/test bridge state;
- expected URL;
- expected rendered data.

### 8. Add Harness-Comet metadata

All generated Harness tests must include `@harness`.

Example:

```ts
test(
  "Confirming save submits the expected annotation payload",
  {
    tag: ["@harness", "@annotation", "@save", "@critical"]
  },
  async ({ page }, testInfo) => {
    // ...
  }
);
```

Use existing project tags before inventing new ones.

Recommended classifications:

- `@smoke` for a fast representative path;
- `@critical` for a release-blocking business promise;
- `@incident` for escaped regressions;
- domain tags such as `@annotation`, `@canvas`, `@save`.

Do not tag every generated test as `@critical`.

### 9. Assert complete business behavior

A good test usually contains three assertion layers.

#### User-visible result

Examples:

- success status is displayed;
- dialog closes or remains open as required;
- route changes;
- form stays dirty after cancellation;
- error message is accessible.

#### Data or integration result

Examples:

- request is sent exactly once;
- request is not sent;
- payload matches an expected fixture;
- persisted response is rendered;
- expected state transition occurs.

#### Evidence

Attach valuable structured evidence:

```ts
await testInfo.attach("saved-payload", {
  body: JSON.stringify(capturedPayload, null, 2),
  contentType: "application/json"
});
```

Do not attach secrets, access tokens, or unnecessary large payloads.

### 10. Handle negative behavior explicitly

For cancellation or rejection flows, prove the forbidden effect did not happen.

Example:

```ts
let requestCount = 0;

await page.route("**/api/annotations", async route => {
  requestCount += 1;
  await route.fulfill({ status: 200, body: "{}" });
});

await page.getByRole("button", { name: "Cancel" }).click();

expect(requestCount).toBe(0);
await expect(page.getByTestId("editor-dirty-state")).toHaveText("Unsaved");
```

Do not treat “dialog disappeared” as sufficient proof that no request was sent.

### 11. Create incident assets when appropriate

When the request is a regression and the CLI supports incident creation, prefer:

```bash
pnpm exec harness-comet create incident <incident-id> \
  --title "<title>" \
  --issue-url "<url>"
```

Then place exact reproduction input and expected output in the generated incident structure.

Do not fabricate an issue URL.

### 12. Validate generated assets

Run the narrowest useful checks first.

Required checks:

```bash
pnpm exec harness-comet validate
pnpm exec harness-comet tests list
pnpm exec playwright test --list
```

Run the changed test:

```bash
pnpm exec harness-comet run -- <changed-test-file>
```

When available, also run project checks:

```bash
pnpm exec eslint <changed-files>
pnpm exec tsc --noEmit
```

If the repository provides a dedicated authoring verifier, use it:

```bash
pnpm exec harness-comet authoring verify \
  --files <changed-test-files> \
  --run
```

Do not assume this command exists.

### 13. Repair failures using evidence

When a generated test fails:

1. Read the Playwright error and call log.
2. Read `error-context.md`.
3. Inspect screenshot, video, or trace when present.
4. Check request interception patterns.
5. Check whether the application reached the intended route and state.
6. Check selectors against the current implementation.
7. Fix the smallest incorrect assumption.
8. Re-run only the target test.
9. Re-run Harness validation.

Do not weaken assertions merely to make the test pass.

Do not add arbitrary sleeps.

Do not modify production behavior unless the requirement exposes a missing testability hook and the user permits that change.

## Output Contract

After implementation, report:

### Coverage

- requirement covered;
- test cases added or updated;
- important negative paths;
- anything intentionally not covered.

### Files

- created files;
- updated files;
- reused helpers and fixtures.

### Verification

- commands executed;
- collected test count;
- pass/fail result;
- location of reports and structured Harness results.

### Remaining risks

- environment dependencies;
- missing stable selectors;
- missing test bridge;
- behavior that still requires manual review.

## Quality Gate

Do not mark the task complete unless all applicable statements are true:

- [ ] The test maps to a concrete requirement or regression.
- [ ] Existing test architecture was inspected.
- [ ] Existing helpers and fixtures were reused where appropriate.
- [ ] Every Harness test includes `@harness`.
- [ ] No `page.waitForTimeout` was added.
- [ ] Selectors are stable and project-consistent.
- [ ] Test data is deterministic.
- [ ] The primary business outcome is asserted.
- [ ] Save/persistence behavior asserts payload or persisted result.
- [ ] Negative behavior proves the forbidden side effect did not occur.
- [ ] The test is collected by Playwright.
- [ ] Harness-Comet validation passes.
- [ ] The target test was run, unless the environment made execution impossible.
- [ ] Any execution limitation is stated honestly.

## Common Failure Modes

### Generic generated test

Bad:

- creates a new isolated HTML page unrelated to the application;
- uses invented selectors;
- verifies only that a button exists.

Good:

- uses the real application route;
- follows existing fixture and helper conventions;
- asserts the actual business outcome.

### Over-mocking

Bad:

- mocks the serializer while claiming to test serialization;
- mocks all state transitions and only tests HTML wiring.

Good:

- mocks external instability;
- keeps the target behavior real.

### Kitchen-sink scenario

Bad:

- one test covers create, edit, save, delete, export, reload, and permissions.

Good:

- one test preserves one business promise with a small number of meaningful assertions.

### Weak negative test

Bad:

- clicks Cancel and asserts the dialog closes.

Good:

- asserts the save request was not sent and unsaved state remains.

### Passing by weakening

Bad:

- removes payload assertion after mismatch;
- increases timeout without understanding readiness;
- replaces exact business assertion with `toBeVisible`.

Good:

- diagnoses the mismatch and fixes setup, implementation, or expected fixture.
