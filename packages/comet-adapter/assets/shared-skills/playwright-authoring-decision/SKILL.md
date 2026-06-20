---
name: playwright-authoring-decision
description: Convert a Playwright impact analysis into an explicit user-confirmed authoring decision without modifying Playwright assets.
---

<!-- Managed by @hapergg/harness-comet. -->

# Playwright Authoring Decision

## Responsibility

Present the normalized impact analysis and record exactly which Playwright work the user authorizes. Do not edit tests.

## Inputs

- concrete requirement or change;
- output from `playwright-impact-analysis`;
- context: `comet` or `standalone`;
- optional explicit target instructions.

## Decision contract

The analysis is a recommendation, not a decision. Supported target operations are:

- `verify`;
- `update`;
- `create`;
- `retire`;
- `ignore`.

Present changed behaviors, affected tests, recommendation and confidence per test, coverage gaps, and unresolved questions.

Offer:

1. accept all recommendations;
2. review targets individually;
3. skip Playwright authoring;
4. provide a custom selection.

In Comet context, combine this with the existing Open confirmation rather than asking a second unrelated confirmation.

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
  notes: []
```

For new tests, behavior is required and path may remain provisional until planning. For existing tests, path is required.

## Prohibited behavior

- Do not silently convert recommendations into decisions.
- Do not expose `none`, `verify-existing`, or `update-or-create` as the user-facing choice.
- Do not edit Playwright files.
- Do not modify `.harness-comet/manifest.json`.
- Do not enable authoring with no non-ignored target.
