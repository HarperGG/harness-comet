---
name: harness-flow-to-scenario
description: Use when a user wants to turn a core business workflow, regression, or acceptance flow into reproducible Harness scenarios, fixtures, adapter actions, inspectors, and assertions.
---

# Harness Flow To Scenario

## Overview

Turn one business workflow into a small, verifiable Harness asset set.

Your job is to help the user produce:

- one scenario worth preserving
- the smallest fixture set needed to run it
- the required adapter actions, inspectors, and oracles
- draft artifacts the user can validate immediately

Do not broaden scope into full regression planning unless the user asks.

## When To Use

Use this skill when the user is trying to:

- preserve a core feature as a repeatable Harness scenario
- convert a manual QA flow into `scenario + fixture`
- turn an acceptance criterion into a Harness draft
- identify what actions, inspectors, or oracles are missing for one workflow

Do not use this skill for:

- implementing adapter code directly
- broad test strategy across many features
- debugging one failing action or inspector

## Workflow

### 1. Bound one workflow

Reduce the request to one business promise:

- start state
- action
- observable result
- regression risk

If the request is broad, choose one high-value path first.

### 2. Choose the execution layer

Prefer `memory` when state transitions can represent the behavior.

Prefer `playwright` only when the workflow depends on:

- DOM behavior
- navigation
- request capture
- console or page errors
- real browser interaction

Explain the choice in one or two sentences.

### 3. Extract Harness structure

Map the workflow into:

- scenario ID
- adapter
- fixture refs
- ordered steps
- ordered assertions
- expected values or expected references

Prefer one scenario with 1-4 meaningful assertions over a long kitchen-sink scenario.

### 4. Extract fixture needs

Decide:

- what data is required before the flow starts
- what data should be inline
- what should live in fixture data files
- what should be synthetic by default

Prefer small fixtures with explicit names.

### 5. Check capability gaps

Before drafting files, identify:

- required actions
- required inspectors
- required oracles

Mark each as either:

- already available
- likely available but should be confirmed
- missing and must be implemented

Do not silently assume capabilities exist.

### 6. Draft artifacts

Produce a first-pass:

- `*.scenario.yaml`
- `fixture.yaml`
- optional `data.json`

If the user already has files, revise them instead of creating a parallel version.

### 7. End with validation commands

Always provide exact commands:

```bash
harness-comet validate
harness-comet scenario explain <scenario-id>
harness-comet run --scenario <scenario-id>
```

If the draft depends on missing actions or inspectors, say that before recommending `run`.

## Output Contract

Your default deliverable should be:

1. Workflow summary
2. Layer choice
3. Capability checklist
4. Scenario draft
5. Fixture draft
6. Validation commands

When a draft would be too speculative, stop after the capability checklist and explain what single missing detail blocks a useful draft.

## Working Rules

- Keep the user focused on one scenario at a time.
- Prefer stable assertions over incidental UI details.
- Prefer reusable fixture names over generic names like `data-1`.
- Avoid Playwright when a memory-level scenario captures the same business risk.
- If the repository already has existing scenarios or fixtures, reuse naming patterns instead of inventing a new style.

## Common Mistakes

- Scenario too broad:
  Split to one business promise.

- Fixture too large:
  Keep only the state needed before the first step.

- Assertions too noisy:
  Verify business outcome, not incidental text unless the text is the outcome.

- Choosing Playwright too early:
  Start at `memory` unless browser behavior is the thing being tested.

- Missing capability hidden in prose:
  List missing actions and inspectors explicitly.

## References

Read [scenario-design.md](references/scenario-design.md) when you need:

- scenario boundary heuristics
- fixture granularity heuristics
- example output shape
- prompts for capability-gap analysis
