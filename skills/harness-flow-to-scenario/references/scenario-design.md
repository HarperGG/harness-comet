# Scenario Design Reference

## Boundary Heuristics

Choose a scenario boundary that preserves one business promise.

Good boundaries:

- `login-basic-success`
- `order-submit-with-discount`
- `annotation-save-polygon`

Weak boundaries:

- `full-user-journey`
- `all-order-flows`
- `everything-about-checkout`

Signs a scenario is too broad:

- it mixes multiple independent outcomes
- it needs many unrelated fixtures
- it requires different adapters
- failure analysis would be ambiguous

## Fixture Heuristics

A fixture should represent stable preconditions, not every detail of the world.

Good fixture names:

- `order-draft-with-coupon`
- `todo-empty`
- `existing-admin-user`

Weak fixture names:

- `fixture1`
- `data`
- `sample`

Prefer inline fixture data when:

- the data is tiny
- the scenario is the only likely consumer
- readability is better inline

Prefer `data.json` when:

- the structure is large
- the data will be reused
- keeping YAML concise helps review

## Assertion Heuristics

Good assertions:

- confirm business state change
- confirm a stable visible result
- confirm a captured request payload when that payload matters

Avoid assertions that:

- depend on fragile timing
- assert implementation details with no business meaning
- duplicate the same business fact through many surfaces

## Capability Gap Checklist

Before drafting assets, ask:

1. What action performs the business step?
2. What inspector reads the outcome?
3. What oracle best matches the outcome?
4. Does the repository already expose those names?
5. If not, what exact missing capability must be implemented?

Recommended status labels:

- `available`
- `confirm`
- `missing`

## Suggested Output Shape

Use this shape when drafting for the user:

### Workflow Summary

- business flow
- start state
- expected outcome

### Layer Choice

- `memory` or `playwright`
- one or two sentence reason

### Capability Checklist

- actions
- inspectors
- oracles

### Scenario Draft

```yaml
schemaVersion: 1
id: example-scenario
title: Example scenario
adapter: memory
fixtureRefs: [example-fixture]
steps:
  - action: domain.action
    input: {}
assertions:
  - inspect: domain.result
    oracle: value.equals
    expected: expected-value
```

### Fixture Draft

```yaml
schemaVersion: 1
id: example-fixture
inline: {}
source: synthetic
containsSensitiveData: false
```

### Validation Commands

```bash
harness-comet validate
harness-comet scenario explain example-scenario
harness-comet run --scenario example-scenario
```

## Example Prompt

Input:

`把“提交订单后总价变成折后价并且状态变成 submitted”沉淀成 Harness 场景`

Expected reasoning:

- one workflow: submit discounted order
- likely `memory` first if browser behavior is not the core risk
- fixture: draft order with coupon
- missing capabilities:
  - `order.submit`
  - `order.total`
  - `order.status`
