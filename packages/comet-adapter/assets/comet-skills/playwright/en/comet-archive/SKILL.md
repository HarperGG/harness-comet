---
name: comet-archive
description: "Comet Phase 5: Archive. Preserve the complete upstream Archive workflow and integrate Harness/Playwright receipt freshness checks."
---

# Comet Phase 5: Archive (Archive)

<!--
Managed by @hapergg/harness-comet.
Upstream baseline: https://github.com/rpamis/comet/tree/master/assets/skills/comet-archive
This managed copy preserves the upstream workflow and adds Harness/Playwright archive preflight.
Do not edit an installed copy directly.
-->

## Prerequisites

- Verification passed (Phase 4 complete)
- Branch handled
- `verify_result: pass` in `openspec/changes/<name>/.comet.yaml`

## Steps

### 0a. Output Language Constraint

Archive summaries and lifecycle closure notes must use the language of the user request that triggered this workflow.

### 0b. Entry State Verification (Entry Check)

Execute entry verification:

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
if [ -z "$COMET_STATE" ] || [ -z "$COMET_ARCHIVE" ]; then
  echo "ERROR: Comet scripts not found. Ensure the comet skill is installed." >&2
  return 1
fi
"$COMET_BASH" "$COMET_STATE" check <name> archive
```

Proceed only after verification passes.

### 1. Harness/Playwright Archive Preflight

If the project is in Playwright mode and the change contains a `Playwright Authoring Decision`, Playwright plan, or Harness verification receipt, run before presenting the final archive confirmation:

```bash
pnpm exec harness-comet comet archive-check --change <change-name>
```

The preflight must confirm:

- verification receipt exists and has a passing or explicit not-applicable status
- receipt, results, report, and fingerprints are fresh for the current change state
- declared targets and target operations remain consistent
- required evidence paths still exist
- ignored and retired targets are handled consistently
- required incident bindings or unresolved incident references are valid
- no Playwright asset changed after successful verification without a newer receipt

If preflight fails, do not present the change as archive-ready. Report the exact stale or inconsistent artifact and follow the final confirmation decision flow with archive unavailable until re-verification succeeds.

Do not edit `.harness-comet/manifest.json`, receipts, or fingerprints to simulate freshness.

### 2. Final Archive Confirmation (Blocking Point)

After entry verification and applicable Harness preflight pass, follow `comet/reference/decision-point.md` and wait for explicit confirmation. Do not run the archive script before confirmation.

Present a brief summary:

- change name
- verification report path and result
- branch handling status
- applicable Playwright targets, receipt path, receipt status, and archive-check result
- irreversible actions: OpenSpec delta merge into main specs, Design Doc and plan annotation, and moving the active change to the archive directory

Use a single-select question with these options:

- **Confirm archive** — immediately run the archive script
- **Needs adjustment or re-verification** — do not archive; transition back to Verify and invoke `/comet-verify`
- **Do not archive yet** — keep `phase: archive` and wait for a later `/comet-archive`

For re-verification, run only after the user chooses it:

```bash
"$COMET_BASH" "$COMET_STATE" transition <change-name> archive-reopen
```

Then invoke `/comet-verify`. If Verify finds implementation fixes are needed, follow its verification-failure decision flow back to `/comet-build`.

Never edit `.comet.yaml` manually.

### 3. Execute Archive

Only after **Confirm archive**, run:

```bash
"$COMET_BASH" "$COMET_ARCHIVE" "<change-name>"
```

The native script performs:

1. entry-state validation (`phase=archive`, `verify_result=pass`, `archived=false`)
2. Design Doc frontmatter annotation (`archived-with`, `status`)
3. plan frontmatter annotation (`archived-with`)
4. OpenSpec archive with delta-merge semantics and change-directory movement
5. main-spec guard against leaked delta-only section headings
6. `comet-state transition <archive-name> archived` to set `archived: true`

A non-zero exit code is failure: report the error and stop. A zero exit code means archive completed.

The `X/Y steps succeeded` summary counts actual executed steps and does not double-count spec sync or document annotation.

OpenSpec archive merges `ADDED`, `MODIFIED`, `REMOVED`, and `RENAMED` semantics into main specs, then verifies no delta-only section headings leaked into main specs.

Preview without execution using:

```bash
"$COMET_BASH" "$COMET_ARCHIVE" "<change-name>" --dry-run
```

### 4. Lifecycle Closed Loop

```text
brainstorming → delta spec → implementation → verification → Harness evidence retention → main spec merge → Design Doc annotation → archive
```

## Exit Conditions

- applicable Harness/Playwright archive preflight passed
- user explicitly confirmed archive
- archive script exited with code 0
- `openspec/changes/archive/YYYY-MM-DD-<change-name>/` exists
- archived `.comet.yaml` contains `archived: true`
- required verification report, Harness receipt, results, report, and fingerprints remain available from the archived change or their recorded durable paths

The archive script moves:

```text
openspec/changes/<name>/
```

to:

```text
openspec/changes/archive/YYYY-MM-DD-<name>/
```

> **WARNING:** After successful archive, do not run `"$COMET_BASH" "$COMET_GUARD" <change-name> archive` against the old active change name. The active directory no longer exists. Archive completeness is determined by the archive script exit code and archived-directory state.

## Complete

Comet workflow complete. Start new work with `/comet` or `/comet-open`.

## Context Compression Recovery

Follow `comet/reference/context-recovery.md` with phase `archive`. If `archived: true` and the archive directory exists, archive is complete; do not rerun archive operations.
