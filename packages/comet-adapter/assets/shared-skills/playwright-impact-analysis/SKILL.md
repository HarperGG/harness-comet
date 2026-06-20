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

Search existing `*.spec.*` files by business behavior, route, production implementation, API, fixture, Page Object, helper, tag, incident ID, imports, and changed source dependencies.

Do not treat filename or keyword similarity alone as proof. Read plausible candidates and explain the relationship.

## Analysis rules

Classify candidate tests as real application, frontend integration, component, API contract, infrastructure self-test, demo/example, or legacy pattern.

Recommend `verify`, `update`, `retire`, or `ignore` for existing tests, and `create` for uncovered behavior.

Every recommendation must include exact path or behavior, covered behavior, impact reason, recommendation, confidence, and evidence paths.

## Required output

```yaml
playwrightImpactAnalysis:
  changedBehaviors:
    - behavior: ...
      evidence: [src/...]
  affectedTests:
    - path: tests/journeys/example.spec.ts
      classification: business-e2e
      coveredBehaviors: [...]
      impactReasons: [...]
      recommendation: verify | update | retire | ignore
      confidence: high | medium | low
      evidence: [src/..., tests/...]
  coverageGaps:
    - behavior: ...
      recommendation: create
      confidence: high | medium | low
      evidence: [src/...]
  unresolvedQuestions: []
```

## Completion conditions

Complete only when relevant production code and plausible tests were inspected, affected tests and gaps are separated, uncertainty is explicit, and no files were modified.
