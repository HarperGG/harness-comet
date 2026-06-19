---
name: playwright-authoring
description: Explicitly invoked standalone workflow that analyzes a concrete requirement, records an authoring decision, plans, implements, and verifies complete project-consistent Playwright assets without requiring Comet.
---

# Playwright Authoring

## Activation contract

This skill is explicit-invocation only.

Activate only when:

1. the user explicitly selects, invokes, or names `playwright-authoring`; and
2. the request includes a concrete requirement, bug description, acceptance criterion, or user workflow.

Do not activate from topic similarity or a general Playwright question.

If explicitly invoked without a concrete requirement, ask for exactly one concrete requirement before inspecting or modifying the repository.

## Responsibility

Orchestrate the shared Playwright authoring stages in standalone mode so that standalone and Comet workflows use the same analysis, decision, planning, implementation, and verification contracts.

This skill must not duplicate or weaken stage rules. The stage skills are the source of truth.

## Storage mode

Use `playwright-authoring-standalone-adapter`.

Persist workflow metadata in one session document:

```text
docs/testing/authoring/<session-id>.md
```

Do not create a Comet/OpenSpec change, `.comet.yaml`, or Comet phase state.

## Required workflow

### 1. Analyze impact

Execute `playwright-impact-analysis` with the concrete requirement and repository context.

Persist its normalized output through `playwright-authoring-standalone-adapter` under:

```md
## Playwright Impact Analysis
```

### 2. Record the authoring decision

Execute `playwright-authoring-decision` in `standalone` context.

Explicit invocation authorizes entering the authoring workflow, but ambiguous target selection must still be resolved according to the decision skill.

Persist the result under:

```md
## Playwright Authoring Decision
```

If `enabled` is false, write the decision and stop without modifying Playwright assets.

### 3. Produce the plan

Execute `playwright-authoring-plan` using:

- the original requirement;
- impact analysis;
- confirmed decision;
- current repository context.

Persist the result under:

```md
## Playwright Authoring Plan
```

### 4. Implement the plan

Execute `playwright-authoring-build` using the approved plan.

Do not add undeclared targets or redesign scope.

Persist the build result under:

```md
## Playwright Build Result
```

### 5. Verify the assets

Execute `playwright-authoring-verify` against every declared runnable target.

Persist the result under:

```md
## Playwright Verification
```

Do not report success when execution failed, was blocked, or did not exercise the planned production boundary.

## Final response

Report:

- standalone session document path;
- created, updated, and retired files;
- reused fixtures and support assets;
- real route and production source paths exercised;
- verification commands and outcomes;
- blockers or product defects;
- whether every requirement was covered.

## Consistency requirement

Given the same requirement, confirmed target decision, repository state, and approved plan, this standalone workflow must produce the same core Playwright assets as the Comet workflow.

Allowed differences are limited to workflow metadata storage:

- standalone metadata lives in `docs/testing/authoring/<session-id>.md`;
- Comet metadata may live in Comet-native phase documents and verification records.

The following must not differ by workflow mode:

- real application boundary;
- test path selection;
- fixture and network strategy;
- assertions;
- tags;
- Playwright asset contents;
- verification standards.
