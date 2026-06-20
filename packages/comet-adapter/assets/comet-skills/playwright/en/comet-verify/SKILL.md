---
name: comet-verify
description: "Comet Phase 4: Verify and Close with deterministic Harness-Comet Playwright verification."
---

# Comet Phase 4: Verify and Close

<!-- Managed by @hapergg/harness-comet. Based on rpamis/comet master. -->

## Prerequisites

- Code committed.
- All tasks completed.
- Active change is in `phase: verify`.

## Steps

### 0. Entry State Verification

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
"$COMET_BASH" "$COMET_STATE" check <name> verify
```

### 1. Native Comet Verification

Run native Comet scale assessment, dirty-worktree handling, and Superpowers `verification-before-completion`. Verify implementation against OpenSpec and the Design Doc with fresh command evidence. Do not fix implementation directly in Verify.

### 2. Harness Playwright Change Verification

If the change contains a Playwright Authoring Decision, run before branch finishing:

```bash
pnpm exec harness-comet comet verify --change <change-name>
```

The command must run only declared runnable targets, exclude ignored and retired targets, require reporter output, verify target coverage, and write results, report, receipt, and fingerprints.

Do not create, update, retire, or redesign Playwright assets during Verify.

If verification fails, report exact targets and evidence and use the native Comet verification-failure decision flow. Return to Build only after the user chooses to fix.

### 3. Branch Finishing

After native and Harness verification pass, load Superpowers `finishing-a-development-branch` and follow native Comet branch handling rules.

### 4. Verification Report and Guard

Include native evidence, Playwright targets, receipt path, results path, report path, status, evidence count, and branch handling result in the Comet verification report.

Set state through Comet scripts, then run:

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> verify --apply
```

## Exit Conditions

- native verification passed;
- Harness Playwright verification passed or produced an explicit not-applicable receipt;
- report and receipt exist;
- branch handling is complete;
- native guard transitions to archive.
