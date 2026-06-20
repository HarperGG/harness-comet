---
name: comet-archive
description: "Comet Phase 5: Archive with Harness-Comet Playwright receipt freshness checks."
---

# Comet Phase 5: Archive

<!-- Managed by @hapergg/harness-comet. Based on rpamis/comet master. -->

## Prerequisites

- Verification passed.
- Branch handled.
- `verify_result: pass`.

## Steps

### 0. Entry State Verification

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
"$COMET_BASH" "$COMET_STATE" check <name> archive
```

### 1. Harness Playwright Archive Preflight

If the change contains a Playwright Authoring Decision, run before asking the user to archive:

```bash
pnpm exec harness-comet comet archive-check --change <change-name>
```

Confirm receipt status and fingerprints, declared target consistency, required paths, results/report existence, and Incident bindings.

If preflight fails, do not present archive as ready. Offer to return to Verify or leave the change in Archive state.

### 2. Final Archive Confirmation

Follow `comet/reference/decision-point.md`. Present change name, verification result, Playwright receipt and targets, archive-check result, branch status, and irreversible actions.

Options:

- confirm archive;
- request adjustment or re-verification;
- do not archive yet.

Use the native `archive-reopen` transition for re-verification. Do not edit `.comet.yaml` manually.

### 3. Execute Archive

Only after confirmation:

```bash
"$COMET_BASH" "$COMET_ARCHIVE" "<change-name>"
```

The native archive script remains responsible for validation, annotation, OpenSpec delta merge, main-spec guards, directory movement, and archived state.

Do not run an archive guard against the old active change name after the directory moves.

## Exit Conditions

- Playwright archive preflight passed when applicable;
- user confirmed archive;
- native archive script succeeded;
- archived directory exists;
- archived `.comet.yaml` records `archived: true`.
