---
name: comet-build
description: "Comet Phase 3: Plan and Build. Preserve the complete upstream Build workflow and integrate Playwright authoring implementation and verification."
---

# Comet Phase 3: Plan and Build (Build)

<!--
Managed by @hapergg/harness-comet.
Upstream baseline: https://github.com/rpamis/comet/tree/master/assets/skills/comet-build
This managed copy preserves the upstream workflow and adds Harness/Playwright steps.
Do not edit an installed copy directly.
-->

## Prerequisites

- Design Doc has been created (Phase 2 complete)
- Active change exists

## Steps

### 0. Entry State Verification (Entry Check)

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
if [ -z "$COMET_STATE" ] || [ -z "$COMET_GUARD" ]; then
  echo "ERROR: Comet scripts not found. Ensure the comet skill is installed." >&2
  return 1
fi
"$COMET_BASH" "$COMET_STATE" check <name> build
```

Proceed only after verification passes.

**Idempotency:** Read `.comet.yaml` to confirm the phase remains `build`, read the plan header `base-ref`, then locate the first unchecked task with:

```bash
grep -n '\- \[ \]' openspec/changes/<name>/tasks.md | head -1
```

Resume from that task. Do not repeat or recommit completed work.

### 1. Create Plan (Subagent Offload)

Create the implementation plan through a subagent so planning does not consume the main-session context. Plan files and execution feedback must use the language of the user request that triggered this workflow.

The planning subagent must:

1. Immediately load Superpowers `writing-plans` with:

   ```text
   Language: Use the language of the user request that triggered this workflow
   ```

2. Read the Design Doc under `docs/superpowers/specs/`.
3. Read `openspec/changes/<name>/tasks.md`.
4. Read `## Playwright Authoring Plan` when present.
5. Follow the skill guidance and create an executable plan.

The plan must be saved to:

```text
docs/superpowers/plans/YYYY-MM-DD-<feature>.md
```

Its frontmatter must include:

```yaml
---
change: <openspec-change-name>
design-doc: docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
base-ref: <git rev-parse HEAD before implementation>
---
```

Record `base-ref` before implementation:

```bash
git rev-parse HEAD
```

For Playwright targets, preserve every approved path and operation exactly:

- `verify`: verification task without planned edits
- `update`: edit only approved test/support assets
- `create`: create only approved paths
- `retire`: remove the approved target and references
- `ignore`: create no implementation task

Do not introduce undeclared targets.

Dispatch the planning task using the platform's real subagent mechanism. If it fails or returns an invalid path, load `writing-plans` inline in the main session as a degraded fallback.

### 2. Update Plan Status and Provide Plan-Ready Pause Point

Record the plan:

```bash
"$COMET_BASH" "$COMET_STATE" set <name> plan docs/superpowers/plans/YYYY-MM-DD-feature.md
```

Then follow `comet/reference/decision-point.md` and ask the user to choose:

| Option | Behavior | Description |
|---|---|---|
| A | Continue execution | Stay in the current model and proceed to workflow selection |
| B | Pause to switch model | Record `build_pause: plan-ready` and stop this invocation |

Do not auto-continue. Do not write this pause into `build_mode`.

Continue:

```bash
"$COMET_BASH" "$COMET_STATE" set <name> build_pause null
```

Pause:

```bash
"$COMET_BASH" "$COMET_STATE" set <name> build_pause plan-ready
```

After pausing, do not choose isolation, execution method, or load an execution skill.

### 3. Select Workflow Configuration

When resuming from `build_pause: plan-ready` and the plan exists, do not rerun planning. Tell the user the workflow is paused at plan-ready, wait for confirmation, clear the pause, then continue.

Ask for workspace isolation, execution method, and TDD mode in one interaction.

#### Workspace Isolation

| Option | Method | Description |
|---|---|---|
| A | Create branch | Simple and fast in the current repository |
| B | Create worktree | Fully isolated and suitable for parallel work |

Recommendations only:

- ≤ 3 changed files → recommend branch
- parallel development or dirty current branch → recommend worktree

#### Execution Method

| Option | Skill | Scenario |
|---|---|---|
| A | `subagent-driven-development` | Independent or complex tasks requiring two-phase review |
| B | `executing-plans` | Simple tasks or no real subagent environment |

Recommendations only:

- ≥ 3 tasks → recommend subagent-driven development
- ≤ 2 tasks without cross-module dependencies → recommend executing plans
- hotfix → recommend executing plans

#### TDD Mode

| Option | Meaning |
|---|---|
| `tdd` | Write and verify a failing test before implementation for every task |
| `direct` | Implement directly without enforced TDD |

This is a blocking user decision. Do not choose from recommendation rules.

Record selections:

```bash
"$COMET_BASH" "$COMET_STATE" set <name> isolation <branch|worktree>
"$COMET_BASH" "$COMET_STATE" set <name> tdd_mode <tdd|direct>
```

For `executing-plans`:

```bash
"$COMET_BASH" "$COMET_STATE" set <name> subagent_dispatch null
"$COMET_BASH" "$COMET_STATE" set <name> build_mode executing-plans
```

For `subagent-driven-development`, first verify the platform has real background Task/subagent/multi-agent dispatch. Only then record:

```bash
"$COMET_BASH" "$COMET_STATE" set <name> subagent_dispatch confirmed
"$COMET_BASH" "$COMET_STATE" set <name> build_mode subagent-driven-development
```

If real dispatch cannot be confirmed, do not set subagent mode. Pause and ask the user to choose `executing-plans`.

`isolation`, `tdd_mode`, and valid `build_mode` are script-enforced hard constraints.

Full workflow must not default to direct mode. Direct mode requires explicit user request and override:

```bash
"$COMET_BASH" "$COMET_STATE" set <name> direct_override true
"$COMET_BASH" "$COMET_STATE" set <name> build_mode direct
```

#### Execute Isolation

For branch isolation, recommend a name and wait for explicit confirmation before creation:

- full → `feature/YYYYMMDD/<change-name>`
- hotfix → `hotfix/YYYYMMDD/<change-name>`
- tweak → `tweak/YYYYMMDD/<change-name>`

After confirmation:

```bash
git checkout -b <branch-name>
```

For worktree isolation, immediately load Superpowers `using-git-worktrees`. Do not replace that skill with plain shell commands. If unavailable, stop and ask the user to install or enable it.

If the plan is not committed before worktree creation, commit it first.

#### Execute Plan

For `executing-plans`, immediately load Superpowers `executing-plans` with the same language constraint and execute the plan.

For `subagent-driven-development`, immediately load Superpowers `subagent-driven-development`, then read `comet/reference/subagent-dispatch.md`. The main session coordinates only and must not directly implement tasks. Comet-specific dispatch, isolation, checkoff, TDD, continuous execution, and recovery rules take precedence when more specific.

If subagent dispatch later proves unavailable, pause and wait for the user to choose main-window execution. Update `build_mode` to `executing-plans` only after confirmation.

#### TDD Execution Constraints

If `tdd_mode: tdd` with `executing-plans`, load Superpowers `test-driven-development` once before the first task and follow Red-Green-Refactor for every task. Do not skip failing-test verification. Reload once after context compaction before resuming.

With subagent-driven development, each implementer and fix agent must load `test-driven-development` itself according to `comet/reference/subagent-dispatch.md`.

If `tdd_mode: direct`, no enforced TDD flow applies.

#### Executing-Plans Review Gate

When `build_mode: executing-plans`, after all tasks complete and before the build guard, load Superpowers `requesting-code-review` and request review at least once.

If unavailable, record:

```md
<!-- review skipped: skill unavailable -->
```

in `tasks.md` and continue.

Fix all CRITICAL findings before Verify. Durable records must explain acceptance of any non-CRITICAL finding.

### 3a. Playwright Authoring Execution

Whenever execution reaches a Playwright authoring task:

1. Immediately load `playwright-authoring-build` in `comet` context.
2. Treat the approved Design Doc `Playwright Authoring Plan` as the exact scope boundary.
3. Apply only declared target operations and paths.
4. Test the real application implementation. Mock dependencies, never the feature itself.
5. Preserve approved assertions, tags, fixture/test-data/Page Object/network strategy, and evidence requirements.
6. Do not create standalone authoring session documents.
7. Do not introduce undeclared targets.
8. Update the matching task checkbox only after target-specific acceptance and verification pass.

For subagent-driven development, every implementer or fix agent assigned a Playwright task must load `playwright-authoring-build` before editing Playwright assets.

### 3b. In-Execution Debugging (Debug Gate)

Whenever execution produces a crash, unexpected behavior, test failure, or build failure, immediately load Superpowers `systematic-debugging`.

Do not propose or implement source fixes before root-cause investigation completes. Follow `comet/reference/debug-gate.md` for minimal reproduction, fix verification, and keeping the current change verification loop.

### 4. Spec Incremental Updates

Handle implementation discoveries by scale:

| Scale | Trigger | Approach |
|---|---|---|
| Small | Missing acceptance scenario or edge case | Edit delta spec and `design.md`, append tasks |
| Medium | Interface, component, or data-flow change | Pause for confirmation, then load `brainstorming` and update Design Doc + delta spec |
| Large | New capability | Pause for split confirmation, then create a new change through `/comet-open` |

If new tasks exceed 50% of the initial task count, follow `decision-point.md` and ask whether to split.

Choices must include:

- split into a new change through `/comet-open`
- continue in the current change and durably record scope expansion

Delta specs remain living documents. Commit each update with its reason. Do not sync to the main spec before archive.

A new Playwright target is never a small implicit update. It requires an updated authoring decision and revised Design Doc plan before implementation.

### 5. Context Management

Build may span many tasks.

- After every task, complete acceptance for the selected execution branch before checkoff and commit.
- Use unchecked-task count rather than rereading all tasks.
- Follow `comet/reference/context-recovery.md` with phase `build` after compaction.
- Follow `comet/reference/dirty-worktree.md` when resuming with user/manual changes.
- If attributed changes imply plan or spec changes, route them through Step 4.
- Consider splitting a single task exceeding roughly 200 changed lines into smaller tasks and commits.

### 6. Playwright Authoring Verification and Harness Gate

After implementation and required code review, but before the native build guard:

1. Immediately load `playwright-authoring-verify` in `comet` context.
2. Validate every declared runnable target.
3. Confirm target paths and operations match the approved decision and plan.
4. Confirm `@harness` tags, requirement assertions, real-application boundary, fixtures, mocks, and evidence.
5. Confirm no synthetic replacement application or undeclared target was introduced.
6. Confirm `verify` and `ignore` targets were not edited unless a newly confirmed decision changed them.
7. Record results in the Design Doc under:

   ```md
   ## Playwright Authoring Verification
   ```

8. Run:

```bash
pnpm exec harness-comet comet hook build --change <change-name>
```

If implementation is defective, return to the relevant Build task without broadening scope. If the plan is incomplete or target scope must change, return to Design and obtain a revised user decision.

Do not edit `.harness-comet/manifest.json` to simulate success.

## Exit Conditions

- all `tasks.md` tasks are checked
- implementation and task commits are complete
- project-specific build and tests were explicitly run and passed
- `isolation` is `branch` or `worktree`
- `build_mode` is valid, with dispatch confirmation or direct override when required
- `tdd_mode` is `tdd` or `direct`
- executing-plans review requirements are satisfied
- Playwright authoring verification is recorded and passes when applicable
- Harness-Comet build gate passes in Playwright mode
- native Comet build guard passes with `--apply`

The native guard first uses configured commands:

```yaml
build_command: <command>
verify_command: <command>
```

Configuration may live in the change `.comet.yaml` or repository Comet config files. Only when no command is configured may guard use npm, Maven, or Cargo auto-detection.

Run:

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> build --apply
```

The state advances to `phase: verify` with `verify_result: pending`.

## Automatic Handoff to Next Phase

Follow `comet/reference/auto-transition.md`:

```bash
"$COMET_BASH" "$COMET_STATE" next <change-name>
```

- `NEXT: auto` → invoke the skill named by `SKILL`
- `NEXT: manual` → do not invoke it; prompt the user to run `/<SKILL>`
- `NEXT: done` → workflow is complete
