---
name: comet-verify
description: "Comet Phase 4: Verify and Close. Preserve the complete upstream Verify workflow and integrate deterministic Harness/Playwright verification."
---

# Comet Phase 4: Verify and Close (Verify)

<!--
Managed by @hapergg/harness-comet.
Upstream baseline: https://github.com/rpamis/comet/tree/master/assets/skills/comet-verify
This managed copy preserves the upstream workflow and adds Harness/Playwright verification.
Do not edit an installed copy directly.
-->

## Prerequisites

- Code committed (Phase 3 complete)
- All `tasks.md` tasks completed

## Steps

### 0a. Output Language Constraint

Verification reports and branch-handling notes must use the language of the user request that triggered this workflow.

### 0b. Entry State Verification (Entry Check)

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
if [ -z "$COMET_STATE" ] || [ -z "$COMET_GUARD" ] || [ -z "$COMET_HANDOFF" ]; then
  echo "ERROR: Comet scripts not found. Ensure the comet skill is installed." >&2
  return 1
fi
"$COMET_BASH" "$COMET_STATE" check <change-name> verify
```

Proceed only after verification passes.

**Idempotency:** If `verify_result: pass` and `branch_status: handled`, verification is complete; run the guard to transition. If `verify_result: pending`, restart verification from the beginning.

### 1. Scale Assessment

```bash
"$COMET_BASH" "$COMET_STATE" scale <change-name>
```

The script sets `verify_mode` to `light` or `full`. Any of these requires full verification:

- tasks > 3
- delta-spec capabilities > 1
- changed files > 4

Before verification, handle uncommitted changes through `comet/reference/dirty-worktree.md`.

Verify-specific rules:

1. Dirty implementation, tests, tasks, delta specs, or Design Doc changes belonging to the current change must not be fixed or committed in Verify. Report them and enter the failure decision.
2. Verify-only artifacts such as report drafts or branch records may remain while Verify continues.
3. Implemented work with unchecked tasks is Build state lag; report it and enter the failure decision.

Only after the user chooses to fix may Verify roll back:

```bash
"$COMET_BASH" "$COMET_STATE" transition <change-name> verify-fail
```

`branch_status` is not reset by `verify-fail`. Preserve an already handled branch status on re-verification.

Committed tasks may make working-tree file counts too small. Read the plan `base-ref` and inspect the full commit range:

```bash
PLAN=$("$COMET_BASH" "$COMET_STATE" get <change-name> plan)
BASE_REF=$(grep '^base-ref:' "$PLAN" 2>/dev/null | head -1 | sed 's/^base-ref: *//')
git diff --stat "$BASE_REF"...HEAD
```

If the range exceeds light thresholds or crosses modules, set:

```bash
"$COMET_BASH" "$COMET_STATE" set <change-name> verify_mode full
```

The user or agent may explicitly override with `verify_mode light|full` when justified.

### 1b. Verification Failure Decision (Blocking Point)

When verification fails, follow `comet/reference/decision-point.md`. Do not automatically transition to `verify-fail` or invoke `/comet-build`.

Present:

- each failed item
- severity: CRITICAL, IMPORTANT, WARNING, or SUGGESTION
- recommended handling
- affected targets and evidence

Use CRITICAL only for build failures, test failures, or security issues. Uncertain severity must be downgraded.

Choices:

- **Fix all** — transition `verify-fail`, then invoke `/comet-build`
- **Handle item by item** — CRITICAL and IMPORTANT items must be fixed; WARNING/SUGGESTION may be accepted with durable reason and impact scope

Do not allow “accept all” while any CRITICAL or IMPORTANT failure remains.

After three consecutive verify-fail cycles, the fourth failure must pause with only:

- accept all permitted deviations and record them
- continue fixing

### 2. Artifact Context Loading (Hash On-Demand Read)

```bash
RECORDED_HASH=$("$COMET_BASH" "$COMET_STATE" get <change-name> handoff_hash)
CURRENT_HASH=$("$COMET_BASH" "$COMET_HANDOFF" <change-name> --hash-only 2>/dev/null || echo "")
```

When both hashes are non-empty, non-null, and equal, `tasks.md` need not be reread in full; use unchecked-count inspection. Still read `proposal.md`, `design.md`, delta specs, and the technical Design Doc for comparison.

When hashes differ or are absent, read all required artifacts in full.

**Immediately execute:** Load Superpowers `verification-before-completion`. Skipping this step is prohibited.

Then follow the selected `verify_mode`.

### 2a. Lightweight Verification (Small Changes)

Run six checks:

1. all `tasks.md` tasks are `[x]`
2. changed files match task descriptions, using the full `base-ref...HEAD` range when needed
3. project-specific build passes
4. related tests pass
5. no obvious security issues, hardcoded secrets, or newly unsafe operations
6. lightweight code review passes

For review mode `standard` or `thorough`, load Superpowers `requesting-code-review` and restrict input to this change's diff, tasks, and necessary test evidence. Review only correctness, security, and edge cases.

For `review_mode: off`, skip automated review but record why. Never skip build, tests, security checks, or debugging rules.

Pass requires all six checks and no CRITICAL or IMPORTANT issue.

Report a compact six-row PASS/FAIL table. On failure, enter Step 1b. Transition to `verify-fail` only after the user chooses to fix.

Light mode intentionally skips deep spec-scenario coverage, deep Design Doc comparison, non-correctness style suggestions, and delta-spec/Design Doc drift detection.

### 2b. Full Verification (Large Changes)

**Immediately execute:** Load `openspec-verify-change`. Skipping this step is prohibited.

Verify:

1. every task is complete
2. implementation matches `openspec/changes/<name>/design.md`
3. implementation matches the technical Design Doc
4. all capability-spec scenarios pass
5. proposal goals are satisfied
6. delta specs and Design Doc do not contradict each other
7. the associated Design Doc exists and belongs to this change
8. project build and relevant tests pass with fresh evidence
9. no unresolved CRITICAL or IMPORTANT code-review or security issue remains

On failure, report missing or contradictory items and enter Step 1b. Do not fix implementation directly in Verify.

#### Spec Drift Decision

When delta specs and Design Doc conflict, pause with a single-select decision:

- **Append Implementation Divergence** to the Design Doc and continue; this Verify artifact must not retrigger dirty-worktree handling
- **Return to Build** by transitioning `verify-fail`; Build then updates Design Doc and delta spec through its brainstorming rules
- **Accept deviation** and continue; Archive will mark the Design Doc `superseded-by-main-spec`

Never choose automatically.

### 2c. Harness/Playwright Change Verification

After native light/full verification passes, and before branch finishing, determine whether the project is in Playwright mode and the change has a `Playwright Authoring Decision` or Playwright plan.

Do not create, update, retire, redesign, or repair Playwright assets during Verify.

Run:

```bash
pnpm exec harness-comet comet verify --change <change-name>
```

The deterministic command must:

- execute only declared runnable targets
- exclude `ignore` and retired targets from execution
- ensure `verify` targets were not changed without a revised decision
- require Harness reporter output
- verify declared-target coverage
- validate target paths, operations, tags, assertions, application boundary, and evidence
- write results, report, receipt, and fingerprints
- produce an explicit not-applicable receipt when no runnable target applies

Inspect and record:

- each declared target and operation
- runnable, skipped, ignored, or retired status
- command and exit status
- results path
- report path
- receipt path
- fingerprints
- evidence count and missing evidence

If Harness verification fails, report exact targets and evidence and enter Step 1b. Return to Build only after the user chooses to fix. If target scope or decision must change, return to Design through the appropriate Build/Design flow; never redesign within Verify.

### 3. Finishing (Superpowers)

Only after native and Harness verification pass or Harness returns an explicit not-applicable receipt:

**Immediately execute:** Load Superpowers `finishing-a-development-branch`. Skipping this step is prohibited.

If unavailable, stop and ask the user to install or enable it. Do not substitute ordinary conversation.

Follow its branch options:

1. merge locally to the main branch
2. push and create a PR
3. keep the branch for later
4. discard the work

This is a blocking user decision under `comet/reference/decision-point.md`. Do not choose from recommendations or branch state.

Write `branch_status: handled` only after the chosen operation completes.

Confirm all tests pass and no hardcoded secrets or security issues remain.

### 4. Record Verification Evidence

Save the verification report to disk. It must include:

- verify mode and native check results
- fresh build/test command evidence
- accepted deviations with reason and impact
- branch handling result
- for Playwright: targets, operations, execution status, results/report/receipt paths, fingerprints, evidence count, and not-applicable reason when relevant

```bash
mkdir -p docs/superpowers/reports

"$COMET_BASH" "$COMET_STATE" set <change-name> verification_report docs/superpowers/reports/YYYY-MM-DD-<change-name>-verify.md
"$COMET_BASH" "$COMET_STATE" set <change-name> branch_status handled
```

Do not manually set `verify_result: pass`.

## Exit Conditions

- native verification passed
- Harness/Playwright verification passed or produced a valid explicit not-applicable receipt
- verification report exists and is recorded
- required Harness results, report, receipt, and fingerprints exist
- branch handling completed
- `branch_status: handled`
- no unresolved CRITICAL or IMPORTANT failure remains
- native Verify guard passes with `--apply`

Run:

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> verify --apply
```

The state advances to `phase: archive`, `verify_result: pass`, and records `verified_at`.

## Automatic Handoff to Next Phase

Follow `comet/reference/auto-transition.md`:

```bash
"$COMET_BASH" "$COMET_STATE" next <change-name>
```

- `NEXT: auto` → invoke the skill named by `SKILL`
- `NEXT: manual` → do not invoke it; prompt the user to run `/<SKILL>`
- `NEXT: done` → workflow is complete

After `comet-archive` starts, it must still pause at its final archive-confirmation blocking point. Verification passing never authorizes automatic archive.

## Context Compression Recovery

Follow `comet/reference/context-recovery.md` with phase `verify`.
