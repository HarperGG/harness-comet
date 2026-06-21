---
name: comet-archive
description: "Comet Phase 5: Archive. Invoke with /comet-archive. Merge delta specs into main specs with OpenSpec semantics, archive change."
---

# Comet Phase 5: Archive (Archive)

## Prerequisites

- Verification passed (Phase 4 complete)
- Branch handled
- `verify_result: pass` in `openspec/changes/<name>/.comet.yaml`

## Steps

### 0. Output Language Constraint

Archive summaries and lifecycle closure notes must use the language of the user request that triggered this workflow.

### 0. Entry State Verification (Entry Check)

Execute entry verification:

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
"$COMET_BASH" "$COMET_STATE" check <name> archive
```

Proceed to Step 1 after verification passes. The script outputs specific failure reasons when verification fails.

<!-- HARNESS-COMET:BEGIN archive-project-knowledge -->
### 1. Project Knowledge Update

Before Harness/Playwright archive preflight and final archive confirmation, review whether the completed change should update long-lived project knowledge.

The project knowledge files are:

```text
.agents/rules.md
.agents/structure.md
```

If either file does not exist, create a minimal file before proposing updates. Preserve all content unrelated to this change.

#### 1a. Read the available evidence

Read and combine the available sources below:

- `openspec/changes/<name>/proposal.md`
- `openspec/changes/<name>/design.md`
- `openspec/changes/<name>/tasks.md`
- `openspec/changes/<name>/specs/**`
- the change Design Doc
- the implementation Plan
- the verification report
- current `.agents/rules.md`
- current `.agents/structure.md`
- code and directory changes introduced by this change
- explicit user statements still available in the current context

A complete chat transcript is not required. Archived change artifacts and repository changes are the primary evidence; current conversation context is supplementary.

#### 1b. Extract project rules

Check whether the user explicitly stated any long-lived project rules during this change.

A candidate rule must satisfy all of the following:

1. It comes from an explicit user statement.
2. It applies to future work, not only this change.
3. It is a project-level development constraint, engineering guideline, testing requirement, collaboration convention, or agent-behavior instruction.
4. It is not inferred by the agent from generic best practices.
5. It is not a feature requirement, implementation detail, temporary decision, or one-off task constraint.
6. If long-term intent is uncertain, do not propose it.

Classify rules as:

- Red lines: constraints that must not be violated.
- Engineering guidelines: practices that should be followed in future development.

Compare candidates with the existing `.agents/rules.md` semantically, not only by exact text. Classify each result as no change, add, merge/refine, or conflict.

Do not edit the file yet. Produce a proposed diff and identify the source artifact or explicit user statement supporting every change.

#### 1c. Update project structure knowledge

Check whether this change introduced a long-lived structural change, including:

- adding or removing a major module;
- adding or removing an important directory;
- changing module responsibilities;
- moving capabilities between modules;
- adding a project-wide shared capability;
- changing an important entry point;
- changing dependency direction;
- materially changing how test assets are organized.

Do not update `.agents/structure.md` for ordinary file additions, internal function changes, renames that do not change responsibilities, small styling changes, fixture content changes, assertion changes, or temporary transition structures.

`.agents/structure.md` describes logical structure and module responsibilities. Do not copy the complete repository file tree.

Do not edit the file yet. Produce a proposed diff and identify the evidence for every structural update.

#### 1d. Disclose proposed changes to the user

If no credible rule or structure update is found, explicitly state that no project-knowledge update is required, then continue to archive preflight.

If changes are proposed, show before writing:

- additions, merges/refinements, or conflicts for `.agents/rules.md`;
- additions, modifications, or removals for `.agents/structure.md`;
- the evidence for every proposed item;
- an explicit diff.

Do not hide concrete edits behind a summary.

Offer these choices:

- "Apply all updates" — write all proposed changes.
- "Adjust item by item" — incorporate feedback and show the diff again.
- "Skip knowledge update" — leave `.agents` unchanged and continue.
- "Do not archive yet" — keep the change in Archive and stop.

Only write files after the user explicitly approves all updates or confirms an adjusted diff.

#### 1e. Apply approved updates

After approval:

1. Update `.agents/rules.md`.
2. Update `.agents/structure.md`.
3. Preserve existing content unrelated to this change.
4. Do not add any unapproved candidate.
5. Re-read both files and verify they match the disclosed diff.
6. Continue to Harness/Playwright archive preflight.

If the user skips the knowledge update, leave both files unchanged and continue.
<!-- HARNESS-COMET:END archive-project-knowledge -->

<!-- HARNESS-COMET:BEGIN archive-preflight -->
### 2. Harness/Playwright Archive Preflight

After the project-knowledge review is completed, skipped, or confirmed unnecessary, if the project is in Playwright mode and the change has a Playwright decision, plan, or Harness receipt, run:

```bash
pnpm exec harness-comet comet archive-check --change <change-name>
```

Confirm that the verification receipt is passing or explicitly not applicable; receipt, results, report, and fingerprints are fresh; declared targets and operations remain consistent; required evidence paths exist; ignored and retired targets are consistent; incident bindings are valid; and no Playwright asset changed after verification without a newer receipt.

If preflight fails, do not present the change as archive-ready. Offer upstream re-verification or leave the change in Archive state. Do not edit manifests, receipts, or fingerprints to simulate freshness.
<!-- HARNESS-COMET:END archive-preflight -->

### 3. Final Archive Confirmation (Blocking Point)

After project-knowledge review and archive preflight complete, **must follow the `comet/reference/decision-point.md` protocol to pause and wait for the user to confirm whether to archive immediately**. Must not run `"$COMET_BASH" "$COMET_ARCHIVE" "<change-name>"` before user confirmation.

Before confirmation, show the user a brief summary:
- Change name
- Verification report path and result
- Branch handling status
- Project knowledge update result: updated, unnecessary, or skipped by user
- Irreversible actions this archive will perform: merge main specs with OpenSpec delta semantics, annotate design doc / plan, and move the change to the archive directory

The user confirmation question must be presented as a single-select question with these options:
- "Confirm archive" — immediately run the archive script to complete spec merge and change movement
- "Needs adjustment or re-verification" — do not archive; run `"$COMET_BASH" "$COMET_STATE" transition <change-name> archive-reopen` to return to `phase: verify`, then invoke `/comet-verify`. If verification confirms fixes are needed, follow `/comet-verify`'s verification-failure decision flow back to `/comet-build`
- "Do not archive yet" — do not archive; keep the current `phase: archive` state and wait for the user to invoke `/comet-archive` again later

Only after the user selects "Confirm archive" may Step 4 continue. After the user selects "Needs adjustment or re-verification", must first run the `archive-reopen` state transition; do not edit `.comet.yaml` manually.

### 4. Execute Archive

Run the archive script to automatically complete all steps:

```bash
"$COMET_BASH" "$COMET_ARCHIVE" "<change-name>"
```

The script automatically executes:
1. Entry state validation (phase=archive, verify_result=pass, archived=false)
2. Design doc frontmatter annotation (archived-with, status)
3. Plan frontmatter annotation (archived-with)
4. OpenSpec archive for delta-merge semantics and moving the change to the archive directory
5. Main spec guard against leaked delta-only section headings
6. Update `archived: true` through `comet-state transition <archive-name> archived`

If script returns non-zero exit code, report error and stop.
If script returns zero exit code, archive is complete.
The summary `X/Y steps succeeded` counts real executed steps and does not double-count delta spec sync or document annotation.

The script calls OpenSpec archive to merge `ADDED/MODIFIED/REMOVED/RENAMED` delta semantics into main specs, then verifies main specs do not contain delta-only section headings.

Use `--dry-run` flag to preview without executing.

### 5. Lifecycle Closed Loop

Spec lifecycle completes here:
```
brainstorming → delta spec → implementation → verification → project knowledge update → main spec merge → design doc annotation → archive
```

## Exit Conditions

- Archive script executed successfully (exit code 0)
- Archive directory `openspec/changes/archive/YYYY-MM-DD-<change-name>/` exists
- Archived `.comet.yaml` contains `archived: true`

The archive script moves `openspec/changes/<name>/` to `openspec/changes/archive/YYYY-MM-DD-<name>/`.

> **WARNING**: After successful archive, **do not run** `"$COMET_BASH" "$COMET_GUARD" <change-name> archive` against the old active change name; the active directory no longer exists. Doing so will cause the guard to error with "change directory not found". Archive completeness is determined by script exit code and archived directory state.

## Complete

Comet workflow complete. To start new work, invoke `/comet` or `/comet-open`.

## Context Compression Recovery

Follow `comet/reference/context-recovery.md` with phase set to `archive`. If `archived: true` and archive directory exists, archival is complete — do not re-execute archive operations.
