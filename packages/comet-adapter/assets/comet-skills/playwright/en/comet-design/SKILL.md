---
name: comet-design
description: "Comet Phase 2: Deep Design with integrated Playwright authoring planning."
---

# Comet Phase 2: Deep Design

<!-- Managed by @hapergg/harness-comet. Based on rpamis/comet master. -->

## Prerequisites

- Active change exists with proposal, design, tasks, and `.comet.yaml`.
- Open phase completed.

## Steps

### 0. Entry State Verification

```bash
COMET_ENV="${COMET_ENV:-$(find . "$HOME"/.*/skills "$HOME/.config" "$HOME/.gemini" -path '*/comet/scripts/comet-env.sh' -type f -print -quit 2>/dev/null)}"
if [ -z "$COMET_ENV" ]; then
  echo "ERROR: comet-env.sh not found. Ensure the comet skill is installed." >&2
  return 1
fi
. "$COMET_ENV"
"$COMET_BASH" "$COMET_STATE" check <name> design
```

### 1. Generate OpenSpec Handoff

Generate the handoff package through the Comet script. Agent-authored replacement summaries are prohibited.

```bash
"$COMET_BASH" "$COMET_HANDOFF" <change-name> design --write
```

### 2. Brainstorm and Confirm Technical Design

Immediately load the Superpowers `brainstorming` skill with the user-request language constraint. Use the generated handoff package and preserve OpenSpec as the canonical requirements source.

Do not create the final Design Doc until the user explicitly confirms the design proposal through `comet/reference/decision-point.md`.

Maintain and finalize `openspec/changes/<name>/.comet/handoff/brainstorm-summary.md`, and use the normal Comet context-compaction gate before creating the Design Doc.

### 3. Playwright Authoring Plan

If `proposal.md` contains an enabled `Playwright Authoring Decision`:

1. Immediately load `playwright-authoring-plan`.
2. Use the original requirement, impact analysis, confirmed target decision, confirmed technical approach, and repository context.
3. Do not introduce targets absent from the confirmed decision.
4. Produce requirement-to-assertion mapping, boundary classification, route, production sources, exact test targets and operations, files to create/update/retire, fixture and network strategy, related assets, evidence, and verification commands.

If Playwright authoring is disabled, produce a no-op plan.

### 4. Create Design Doc

Create `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` with minimal Comet frontmatter and include:

```md
## Playwright Authoring Plan
```

Write confirmed Spec Patches back to OpenSpec delta specs.

### 5. Update State and Run Gates

```bash
"$COMET_BASH" "$COMET_STATE" set <name> design_doc docs/superpowers/specs/YYYY-MM-DD-topic-design.md
```

Regenerate handoff when delta specs changed.

For Playwright mode run:

```bash
pnpm exec harness-comet comet hook design --change <change-name>
```

Then run the native guard:

```bash
"$COMET_BASH" "$COMET_GUARD" <change-name> design --apply
```

## Exit Conditions

- Design Doc exists with required frontmatter.
- Playwright plan is present or explicitly no-op.
- Every enabled decision target has a plan entry.
- No undeclared target was introduced.
- Harness-Comet and native Comet design gates pass.
