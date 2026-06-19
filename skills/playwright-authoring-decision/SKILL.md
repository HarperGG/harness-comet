---
name: playwright-authoring-decision
description: Convert a Playwright impact analysis into an explicit user-confirmed authoring decision. Record selected verify, update, create, retire, or ignore operations without modifying Playwright assets.
---

# Playwright Authoring Decision

## Responsibility

Present the normalized impact analysis to the user and record exactly which Playwright work is authorized.

This skill does not inspect the repository again unless the analysis is incomplete. It does not edit tests.

## Inputs

- concrete requirement or change;
- output from `playwright-impact-analysis`;
- execution context: `comet` or `standalone`;
- optional existing user instructions that already select specific tests or operations.

## Decision contract

The analysis is a recommendation, not a decision.

The user must control whether Playwright authoring continues and which operations are authorized.

Supported operations:

- `verify`: run an existing test without planned edits;
- `update`: modify an existing test or its required support assets;
- `create`: add coverage for an uncovered behavior;
- `retire`: remove or disable obsolete coverage only when the product behavior is intentionally removed;
- `ignore`: explicitly leave a candidate outside this change.

## User interaction

Present:

- changed business behaviors;
- affected existing tests and the exact behavior each covers;
- recommendation, confidence, and reason per test;
- uncovered behaviors recommended for creation;
- unresolved questions.

Offer concise choices:

1. accept all recommendations;
2. review targets individually;
3. skip Playwright authoring;
4. provide a custom selection.

In Comet context, combine this decision with Comet's existing Open confirmation rather than asking for a second unrelated confirmation.

In standalone context, explicit invocation of the top-level `playwright-authoring` skill authorizes entering the workflow, but it does not authorize ambiguous target edits. Ask only when the target selection materially changes scope.

## Required output

```yaml
playwrightAuthoringDecision:
  enabled: true | false
  confirmedBy: user
  confirmedAt: <ISO-8601 timestamp>
  targets:
    - path: tests/journeys/example.spec.ts
      behavior: optional description
      operation: verify | update | create | retire | ignore
      reason: ...
  notes:
    - ...
```

For a new test, `behavior` is required and `path` may be provisional until planning resolves the correct project location.

For an existing test, `path` is required.

## Prohibited behavior

- Do not convert recommendations into decisions silently.
- Do not use a single global `none`, `verify-existing`, or `update-or-create` choice as the user-facing decision.
- Do not edit Playwright files.
- Do not modify `.harness-comet/manifest.json`.
- Do not advance with `enabled: true` and no non-ignored target.

## Completion conditions

Complete only when the decision is explicit, target-specific, attributable to the user, and suitable as input to `playwright-authoring-plan`.
