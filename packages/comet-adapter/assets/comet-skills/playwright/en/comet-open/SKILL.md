---
name: comet-open
description: "Comet Phase 1: Open with integrated Playwright impact analysis and authoring decision."
---

# Comet Phase 1: Open

<!--
Managed by @hapergg/harness-comet.
Upstream: https://github.com/rpamis/comet/tree/master/assets/skills/comet-open
Do not edit an installed copy directly.
-->

## Prerequisites

- No active change, or the user wants to create a new change.

## Steps

### 0. Output Language Constraint

Use the language of the user request for prompts and generated artifacts. Preserve the dominant language when resuming an existing change unless the user explicitly asks to switch.

### 1. Explore Ideas and Clarify Requirements

Immediately load `openspec-explore`. Continue clarification until a summary covers goals, non-goals, scope boundaries, key unknowns, and draft acceptance scenarios.

For a large PRD or multiple independently deliverable capabilities, follow `comet/reference/decision-point.md` and let the user decide whether to split the work. Every accepted split item must enter through `/comet-open`.

Before creating artifacts, pause for explicit confirmation that requirements clarification is complete. Confirm the final kebab-case English change name before creating the change.

### 2. Create Change Structure and Initialize State

Immediately load `openspec-new-change`.

Create `proposal`, `design`, and `tasks` through the standard OpenSpec artifact loop using `openspec status` and `openspec instructions`. Do not fall back to hard-coded prose when OpenSpec instructions fail.

Ensure the change contains:

```text
openspec/changes/<name>/
├── .openspec.yaml
├── .comet.yaml
├── proposal.md
├── design.md
└── tasks.md
```

Initialize Comet state:

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
"$COMET_BASH" "$COMET_STATE" init <name> full
"$COMET_BASH" "$COMET_STATE" check <name> open
```

### 3. Content Completeness Check

Confirm:

- `proposal.md` contains background, goals, scope, and non-goals;
- `design.md` contains high-level architecture, approach, and data flow;
- `tasks.md` contains clear checkbox tasks;
- all files exist and are non-empty.

### 4. Playwright Impact Analysis

If `harness-comet.config.ts` resolves to `mode: playwright`:

1. Immediately load `playwright-impact-analysis`.
2. Analyze the confirmed requirement, OpenSpec artifacts, relevant production implementation, existing `*.spec.*` files, fixtures, Page Objects, test data, and support helpers.
3. Do not modify Playwright assets.
4. Write the normalized output into `proposal.md` under:

```md
## Playwright Impact Analysis
```

The section must identify changed behaviors, affected existing tests, coverage gaps, exact evidence paths, recommendation, and confidence.

If the project is not in Playwright mode, skip this step.

### 5. Combined User Review and Playwright Authoring Decision

Follow `comet/reference/decision-point.md` and ask for one combined confirmation. Do not ask for a second independent Playwright confirmation.

Present:

- proposal summary;
- high-level design summary;
- task count and key tasks;
- Playwright changed behaviors;
- affected existing tests and recommendations;
- uncovered behaviors recommended for creation.

If Playwright mode is enabled, immediately load `playwright-authoring-decision` in `comet` context. The user may:

- confirm the Open artifacts and accept recommendations;
- confirm and customize target operations;
- confirm but skip Playwright authoring;
- request adjustments.

Persist the normalized result in `proposal.md` under:

```md
## Playwright Authoring Decision
```

Use target-specific operations: `verify`, `update`, `create`, `retire`, or `ignore`. Do not expose legacy global action names as user-facing decisions.

When authoring is enabled, ensure `tasks.md` contains explicit Playwright planning, implementation, and verification tasks.

### 6. Harness-Comet Open Gate

For Playwright mode, run before the Comet phase guard:

```bash
pnpm exec harness-comet comet hook open --change <change-name>
```

If it fails, fix the reported Open artifacts and rerun it. Do not modify `.harness-comet/manifest.json` to represent a change.

## Exit Conditions

- proposal, design, and tasks exist and are complete;
- the user confirmed the Open artifacts;
- in Playwright mode, impact analysis and target-specific authoring decision are recorded;
- the Harness-Comet Open gate passes;
- run the native Comet guard:

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> open --apply
```

Then follow `comet/reference/auto-transition.md` using:

```bash
"$COMET_BASH" "$COMET_STATE" next <change-name>
```
