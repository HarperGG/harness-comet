# Harness Flow To Scenario Skill Design

## Summary

This skill helps a user turn one concrete business capability into reusable Harness assets:

- `scenario`
- `fixture`
- adapter capability checklist
- inspector/oracle checklist
- validation and execution commands

The skill does not implement adapters or write production logic by itself. Its job is to help the user convert a feature or workflow into a reproducible, verifiable Harness slice with the smallest stable boundary.

Recommended skill name:

`harness-flow-to-scenario`

Recommended trigger description:

`Use when a user wants to turn a core business workflow into reproducible Harness scenarios, fixtures, adapter actions, inspectors, and assertions.`

## Goals

The skill should help Codex do five things well:

1. Identify the smallest business flow worth preserving as a Harness scenario.
2. Split the flow into preconditions, actions, observations, and pass/fail assertions.
3. Recommend the right validation layer:
   `memory` first when possible, `playwright` only when browser behavior matters.
4. Produce draft `scenario` and `fixture` artifacts that the user can validate immediately.
5. Make missing implementation work explicit:
   required actions, inspectors, custom oracles, or project setup gaps.

## Non-Goals

The skill should not:

- invent broad end-to-end coverage when a narrower scenario is enough
- force Playwright for all cases
- generate unstable assertions based on incidental UI text or timing
- silently assume adapter capabilities that do not exist
- replace domain review by the user
- create a second workflow system outside Harness

## Primary Inputs

The skill should work from one of these user inputs:

- a plain-language feature description
- a bugfix or regression story
- an existing manual QA flow
- a PRD acceptance criterion
- a partially written scenario or fixture

Useful optional context:

- current `harness.config.ts`
- existing `harness/scenarios`
- existing `harness/fixtures`
- available adapters
- target verification layer preference

## Outputs

The skill should produce a compact deliverable set:

1. Scenario recommendation
   The proposed scenario ID, title, adapter, tags, and why this flow is worth preserving.

2. Fixture strategy
   What input data is needed, what should be inline, and what should live in a fixture data file.

3. Capability checklist
   Required actions, inspectors, and oracles. Mark which already exist and which must be added.

4. Draft artifacts
   A first-pass `*.scenario.yaml` and `fixture.yaml`, plus `data.json` when needed.

5. Verification commands
   The exact `validate` and `run` commands to confirm the scenario.

## Workflow

The skill should follow this sequence:

### 1. Bound the flow

Turn the user request into one specific workflow:

- start state
- user or system action
- observable result
- business risk if it regresses

If the request is too broad, reduce it to one durable scenario rather than many.

### 2. Choose the execution layer

Default rules:

- Use `memory` when the logic can be represented as state transitions without browser-specific behavior.
- Use `playwright` only when the user needs DOM behavior, navigation, request capture, browser events, or visible workflow interaction.

The skill must explain this choice briefly.

### 3. Extract scenario structure

Map the flow into:

- `fixtureRefs`
- ordered `steps`
- ordered `assertions`
- expected outputs or references

The skill should prefer one scenario with 1-4 meaningful assertions over a long kitchen-sink script.

### 4. Extract reusable test data

Ask:

- what inputs are reused across flows
- what data is stable enough to preserve
- what data is synthetic versus project-derived

The skill should prefer small fixtures with explicit names over one giant catch-all fixture.

### 5. Check implementation gaps

Before writing drafts, compare the proposed flow to available capabilities:

- required adapter actions
- required inspectors
- required oracles

Missing items must be listed explicitly instead of being buried in prose.

### 6. Generate drafts

Produce:

- a scenario YAML draft
- a fixture YAML draft
- optional data JSON draft
- a short note explaining any unresolved placeholders

### 7. Emit validation plan

Always end with exact commands:

```bash
harness-comet validate
harness-comet scenario explain <scenario-id>
harness-comet run --scenario <scenario-id>
```

If the scenario depends on not-yet-implemented actions or inspectors, say so before suggesting `run`.

## Decision Rules

The skill should encode these heuristics:

### Good scenario boundaries

- one business promise
- one clear regression risk
- one adapter per scenario
- few but meaningful assertions

### Good fixture boundaries

- reusable across at least one more plausible flow
- stable enough to name clearly
- synthetic by default
- small enough to inspect quickly

### Good assertions

- verify business outcome, not incidental mechanics
- prefer stable state or structured values
- avoid timing-sensitive checks when a deterministic state read exists

### Good adapter advice

- if the behavior is pure logic or in-memory state, prefer `memory`
- if the behavior depends on UI rendering, navigation, or request capture, prefer `playwright`
- if neither existing adapter fits, say that a custom adapter action is required

## Interaction Style

The skill should keep the interaction narrow and structured.

Preferred questioning pattern:

- ask for the single most important missing business detail
- do not ask for implementation details that can be derived from repository files
- if enough context exists, propose a draft first and ask for correction

The skill should be supportive and practical:

- make the user feel like they are refining a testable artifact
- avoid turning the conversation into abstract QA theory

## Draft SKILL.md Shape

Suggested structure:

```md
---
name: harness-flow-to-scenario
description: Use when a user wants to turn a core business workflow into reproducible Harness scenarios, fixtures, adapter actions, inspectors, and assertions.
---

# Harness Flow To Scenario

## Overview

Turn one business workflow into a small, verifiable Harness asset set.

## When to Use

- New core feature
- Regression worth preserving
- Manual QA flow to automate
- Acceptance criteria that should become a scenario

## Workflow

1. Bound one workflow
2. Choose `memory` or `playwright`
3. Extract fixtures, steps, assertions
4. Check missing capabilities
5. Draft artifacts
6. Emit validation commands

## Output Contract

- Scenario draft
- Fixture draft
- Capability gap list
- Validation commands

## Common Mistakes

- Scenario too broad
- Fixture too large
- Unstable assertions
- Choosing Playwright too early
```

## Example Deliverable

Input:

`用户提交订单后应看到折扣后的总价，并且订单状态变成 submitted`

Expected skill output shape:

1. Scenario proposal
   `order-submit-with-discount`

2. Layer choice
   Start with `memory` if discount calculation and state transition can be modeled without UI.

3. Fixture proposal
   `order-draft-with-coupon`

4. Steps
   - submit order
   - persist status

5. Assertions
   - total equals discounted amount
   - status equals `submitted`

6. Capability gaps
   - action: `order.submit`
   - inspector: `order.total`
   - inspector: `order.status`

## Suggested Follow-Up

After this design draft is approved, the next artifact should be a real skill folder:

```text
skills/
  harness-flow-to-scenario/
    SKILL.md
```

If we want a stronger v2, add:

- example prompts
- anti-pattern examples
- a reference file for scenario ID naming and fixture granularity
