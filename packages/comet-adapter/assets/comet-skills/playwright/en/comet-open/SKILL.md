---
name: comet-open
description: "Comet Phase 1: Open. Preserve the complete upstream Open workflow and integrate Playwright impact analysis and authoring decisions."
---

# Comet Phase 1: Open

<!--
Managed by @hapergg/harness-comet.
Upstream baseline: https://github.com/rpamis/comet/tree/master/assets/skills/comet-open
This managed copy preserves the upstream workflow and adds Harness/Playwright steps.
Do not edit an installed copy directly.
-->

## Prerequisites

- No active change, or user wants to create a new change

## Steps

### 0. Output Language Constraint

Every prompt and artifact request passed to OpenSpec must include the output-language constraint: use the language of the user request that triggered this workflow. When resuming an existing change with a clear dominant artifact language, preserve that language unless the user explicitly asks to switch.

### 1. Explore Ideas and Clarify Requirements

**Immediately execute:** Use the Skill tool to load the `openspec-explore` skill. Skipping this step is prohibited.

After the skill loads, explore the problem space following its guidance, but do not treat one Q&A turn as sufficient clarification. Continue asking, align with the user, and form a clarification summary covering:

- Goals: the problem the user truly wants to solve and the expected outcome
- Non-goals: what is explicitly out of scope for this change
- Scope boundaries: included/excluded modules, users, platforms, or data
- Key unknowns: unresolved assumptions, risks, or dependencies
- Draft acceptance scenarios: at least the core success scenario and important boundary scenarios

The clarification summary must include all five items above.

### 1a. PRD Split Preflight (Blocking Point)

When the user input is a large PRD, roadmap, complete product plan, or the clarification summary shows multiple independent capabilities, modules, user journeys, or milestones, evaluate whether it should be split into multiple changes before creating OpenSpec artifacts.

The proposed split list must include for every item:

- suggested change name
- goals and scope boundaries
- explicit non-goals
- dependencies or recommended execution order
- core acceptance scenarios

Recommend splitting when any condition applies:

- multiple capabilities can be independently designed, built, verified, and archived
- multiple modules or user journeys can be delivered independently
- clear phased milestones exist
- the work is expected to produce multiple delta specs or more than three large tasks
- failure or delay in one part should not block other parts from entering later phases

When splitting is recommended, follow `comet/reference/decision-point.md` and pause for the user's choice. The choices must include:

- **Create multiple OpenSpec changes**
- **Keep everything as one change** — record the reason in proposal/design/tasks
- **Adjust the split plan before continuing**

Every accepted split item must enter through `/comet-open`, not `/opsx:new`, so both OpenSpec artifacts and `.comet.yaml` are created.

Do not create `proposal.md`, `design.md`, or `tasks.md` before the split choice is complete. In batch split mode, the current invocation coordinates the confirmed split, then enters `/comet-open` for each item in the confirmed order.

Each batch item must be marked as a confirmed split item and carry its goals, scope, non-goals, and acceptance scenarios. Confirmed split items skip this preflight unless they still clearly contain multiple independent capabilities.

A batch item must not auto-advance to `/comet-design` when its open phase completes. After all split items are created, pause and ask which change to start. Advance only the selected change.

Resume without a dedicated batch state file. Existing active changes containing `.comet.yaml` must not be recreated. Continue uncreated items from the confirmed split list. If the list cannot be recovered, ask the user to confirm it again.

### 1b. Requirements Clarification Completion Confirmation (Blocking Point)

Before creating OpenSpec artifacts, follow `comet/reference/decision-point.md`, present the complete clarification summary, and wait for explicit confirmation.

Do not create `proposal.md`, `design.md`, or `tasks.md` before confirmation. Do not load `openspec-propose` to generate all artifacts in one pass unless the user explicitly requests that behavior.

### 1c. Change Name Confirmation (Blocking Point)

Before creating the change directory, follow `comet/reference/decision-point.md` and let the user decide the name. Do not silently infer or auto-accept a name.

OpenSpec change names must be kebab-case English using lowercase letters, digits, and hyphens.

Present:

- two or three recommended kebab-case English names, each with a one-line scope description
- an explicit custom-name option
- a note that non-conforming input will be converted to compliant kebab-case English and shown for confirmation

Do not run `openspec new change` or create `.comet.yaml` before the final name is confirmed. If the name collides with an existing change, report the collision and request another name.

### 2. Create Change Structure and Initialize State

**Immediately execute:** Use the Skill tool to load `openspec-new-change`. Skipping this step is prohibited.

Do not load `openspec-propose` by default. Load it only when the user explicitly requests one-pass artifact generation.

Follow `openspec-new-change`, but override its default stop behavior when a confirmed clarification summary from Step 1b already exists. Use that summary directly. If no confirmed summary exists, fall back to asking the user.

Generate `proposal`, `design`, and `tasks` one by one with the standard artifact loop.

For each artifact (`proposal` → `design` → `tasks`):

1. Run `openspec status --change "<name>" --json`.
2. Run `openspec instructions <artifact-id> --change "<name>" --json`.
3. Read every completed dependency artifact listed in `dependencies`.
4. Use `template` as the structure and follow `instruction`.
5. Apply `context` and `rules` as constraints; do not copy them into artifact content.
6. Write to `resolvedOutputPath`.
7. Verify the file exists and is non-empty.
8. Run status again before continuing.

If instructions fail, return invalid JSON, report unmet dependencies, or omit a usable output path, stop and report the OpenSpec error. Do not fall back to hard-coded prose.

The confirmed change name and scope are guards: do not rename, expand, or narrow the change independently.

Confirm this structure exists:

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

if [ -z "$COMET_STATE" ] || [ -z "$COMET_GUARD" ]; then
  echo "ERROR: Comet scripts not found. Ensure the comet skill is installed." >&2
  return 1
fi

"$COMET_BASH" "$COMET_STATE" init <name> full
```

### 3. Entry State Verification

Run:

```bash
"$COMET_BASH" "$COMET_STATE" check <name> open
```

Proceed only after it passes.

**Idempotency:** If `.comet.yaml` is already at `phase: open` and all three artifact files exist, skip completed work and continue from the first missing step.

### 4. Content Completeness Check

Confirm:

- `proposal.md` contains problem background, goals, scope, and non-goals
- `design.md` contains high-level architecture decisions, approach selection, and data flow
- `tasks.md` contains clear checkbox tasks
- all three files exist and are non-empty

If any file is missing or empty, return to artifact creation. Do not proceed to review or any phase guard.

### 5. Playwright Impact Analysis

If `harness-comet.config.ts` resolves to `mode: "playwright"`:

1. Immediately load `playwright-impact-analysis`.
2. Analyze the confirmed requirement, OpenSpec artifacts, relevant production code, existing `*.spec.*` files, fixtures, Page Objects, test data, and support helpers.
3. Do not modify Playwright assets in the open phase.
4. Write normalized results into `proposal.md` under:

```md
## Playwright Impact Analysis
```

The section must identify:

- changed user-visible or system behaviors
- affected existing tests
- coverage gaps
- exact evidence paths
- recommended target operations
- confidence and unresolved uncertainty

If the project is not in Playwright mode, skip this step without altering the upstream flow.

### 6. Combined User Review and Playwright Authoring Decision (Blocking Point)

After completeness checks and impact analysis, follow `comet/reference/decision-point.md` and pause for one combined confirmation. Do not run either guard or auto-transition before confirmation.

Present:

- proposal background, goals, and scope
- design decisions and approach
- task count and key tasks
- Playwright changed behaviors
- affected existing tests and recommendations
- uncovered behaviors recommended for creation

For non-Playwright projects, preserve the upstream single-select choices:

- **Confirm, proceed to next phase**
- **Needs adjustment**

For Playwright projects, immediately load `playwright-authoring-decision` in `comet` context. The combined decision must allow the user to:

- confirm artifacts and accept recommendations
- confirm and customize target-specific operations
- confirm but skip Playwright authoring
- request adjustments

Persist the normalized result in `proposal.md` under:

```md
## Playwright Authoring Decision
```

Use target-specific operations only: `verify`, `update`, `create`, `retire`, or `ignore`. Do not expose legacy global action names as user-facing decisions.

When authoring is enabled, ensure `tasks.md` includes explicit Playwright planning, implementation, and verification tasks.

When the user requests adjustments, update the relevant artifacts, rerun completeness and impact analysis as needed, then ask for confirmation again.

### 7. Harness-Comet Open Gate

For Playwright mode, run before the native Comet guard:

```bash
pnpm exec harness-comet comet hook open --change <change-name>
```

If it fails, fix the reported Open artifacts and rerun it. Do not edit `.harness-comet/manifest.json` to simulate success.

## Exit Conditions

All conditions must be true:

- proposal, design, and tasks exist and are complete
- the user confirmed the Open artifacts
- in Playwright mode, impact analysis and target-specific authoring decision are recorded
- in Playwright mode, the Harness-Comet Open gate passes
- the native Comet guard passes with `--apply`

Run:

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> open --apply
```

`--apply` is mandatory. Full workflow advances to design; hotfix/tweak presets advance directly to build.

## Automatic Handoff to Next Phase

Follow `comet/reference/auto-transition.md`:

```bash
"$COMET_BASH" "$COMET_STATE" next <change-name>
```

- `NEXT: auto` → invoke the skill named by `SKILL`
- `NEXT: manual` → do not invoke it; ask the user to run `/<SKILL>`
- `NEXT: done` → workflow is complete

Hotfix/tweak presets remain controlled by their preset skills. In batch split mode, do not auto-advance an individual split item; wait for the user to select which change starts next.
