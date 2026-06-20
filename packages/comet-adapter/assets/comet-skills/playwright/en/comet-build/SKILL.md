---
name: comet-build
description: "Comet Phase 3: Plan and Build with integrated Playwright authoring implementation and verification."
---

# Comet Phase 3: Plan and Build

<!-- Managed by @hapergg/harness-comet. Based on rpamis/comet master. -->

## Prerequisites

- Design Doc exists.
- Active change is in `phase: build`.

## Steps

### 0. Entry State Verification

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
"$COMET_BASH" "$COMET_STATE" check <name> build
```

Resume from the first unchecked task. Do not repeat committed work.

### 1. Create Implementation Plan

Use a subagent with Superpowers `writing-plans`. Read the Design Doc, `tasks.md`, and `## Playwright Authoring Plan`.

Preserve every Playwright target path and operation:

- `verify`: verification task without planned edits;
- `update`: edit the approved test and support assets;
- `create`: create only approved paths;
- `retire`: cleanup and remove references;
- `ignore`: no task.

Do not introduce undeclared targets. Save the implementation plan under `docs/superpowers/plans/` with Comet metadata and record it through `comet-state`.

Follow the native Comet plan-ready pause point.

### 2. Select Isolation, Execution Method, and TDD Mode

Follow the native Comet user decision protocol for branch/worktree, executing-plans/subagent-driven-development, and tdd/direct. Preserve all native Comet constraints and state fields.

### 3. Execute Plan

Load the selected Superpowers execution skill.

Whenever execution reaches a Playwright authoring task:

1. Immediately load `playwright-authoring-build`.
2. Treat the approved Design Doc plan as the exact scope boundary.
3. Test the real application implementation. Mock dependencies, never the feature itself.
4. Preserve approved paths, operations, fixture strategy, assertions, evidence, and `@harness` tags.
5. Do not create standalone authoring session documents.
6. Do not add undeclared targets.

With subagent-driven development, every implementer or fix agent assigned a Playwright task must load `playwright-authoring-build` before editing tests.

Preserve native Comet TDD, code-review, debugging, checkoff, commit, context-recovery, and scope-expansion rules.

### 4. Incremental Scope Changes

Use native Comet scale rules. A new Playwright target requires an updated user decision and revised Playwright plan before implementation.

### 5. Playwright Authoring Verification

After implementation and required code review, but before the native build guard:

1. Immediately load `playwright-authoring-verify`.
2. Validate every declared runnable target.
3. Confirm paths, operations, tags, requirement assertions, real application boundary, evidence, and test results.
4. Confirm no synthetic replacement page or undeclared target was introduced.
5. Write the result under `## Playwright Authoring Verification` in the Design Doc.
6. Run:

```bash
pnpm exec harness-comet comet hook build --change <change-name>
```

If implementation is defective, return to the relevant Build task without changing scope. If the plan is incomplete, return to Design and update the user decision when scope changes.

## Exit Conditions

- all tasks are checked and code committed;
- native Comet isolation, build-mode, dispatch, TDD, and review constraints are satisfied;
- project build and tests pass;
- Playwright authoring verification and Harness-Comet build gate pass;
- run:

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> build --apply
```
