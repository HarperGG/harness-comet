---
name: playwright-impact-analysis
description: Analyze a concrete requirement, bugfix, or change against the current repository and existing Playwright assets. Produce a read-only impact analysis with affected tests, coverage gaps, recommendations, confidence, and exact repository paths. Never modify files.
---

# Playwright Impact Analysis

## Responsibility

Given one concrete requirement or change, determine how it may affect existing Playwright coverage and where coverage is missing.

This skill is read-only. It must not create, edit, delete, rename, or retire test assets.

## Inputs

- the concrete requirement, bugfix, or change description;
- acceptance criteria and known negative paths;
- repository root;
- optional changed-file list or Comet/OpenSpec context.

## Required inspection

Inspect, when present:

```text
package.json
harness-comet.config.ts
playwright.config.ts
configured Playwright test directories
relevant application routes, components, stores, APIs, serializers, and feature flags
existing fixtures, Page Objects, helpers, and test data
```

Run when available:

```bash
pnpm exec harness-comet --json validate
pnpm exec harness-comet tests list
pnpm exec playwright test --list
pnpm exec harness-comet --json context
```

Search existing `*.spec.*` files by:

- business behavior and acceptance criteria;
- route and navigation target;
- production component or feature name;
- API endpoint or outgoing payload;
- fixture, Page Object, helper, tag, and incident ID;
- imports and support assets related to changed production files.

Do not treat filename or keyword similarity alone as proof of impact. Read each plausible candidate and explain the relationship.

## Analysis rules

For each existing test candidate, classify it as:

- real application test;
- frontend integration test;
- component test;
- API or serialization contract test;
- infrastructure self-test;
- demo/example;
- legacy pattern.

A demo, synthetic page, or infrastructure test is not evidence that a business workflow is covered.

Recommend one operation per affected existing test:

- `verify`: existing behavior should remain valid and the test likely needs no edit;
- `update`: the test, data, helper, or assertion likely needs modification;
- `retire`: the represented business behavior is intentionally removed;
- `ignore`: candidate is related but outside the confirmed requirement.

For uncovered behavior, recommend `create`.

Every recommendation must include:

- exact test path or behavior;
- covered behavior;
- impact reason;
- recommendation;
- confidence: `high`, `medium`, or `low`;
- evidence paths used to reach the conclusion.

## Required output

Return a normalized analysis using this shape:

```yaml
playwrightImpactAnalysis:
  changedBehaviors:
    - behavior: ...
      evidence:
        - src/...
  affectedTests:
    - path: tests/journeys/example.spec.ts
      classification: business-e2e
      coveredBehaviors:
        - ...
      impactReasons:
        - ...
      recommendation: verify | update | retire | ignore
      confidence: high | medium | low
      evidence:
        - src/...
        - tests/...
  coverageGaps:
    - behavior: ...
      recommendation: create
      confidence: high | medium | low
      evidence:
        - src/...
  unresolvedQuestions:
    - ...
```

## Completion conditions

Complete only when:

- relevant production implementation was inspected;
- plausible existing tests were inspected, not only listed;
- affected tests and coverage gaps are separated;
- uncertainty is explicit;
- no files were modified.
