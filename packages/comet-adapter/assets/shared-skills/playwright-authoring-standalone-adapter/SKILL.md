---
name: playwright-authoring-standalone-adapter
description: Persist normalized Playwright authoring stage outputs for the standalone workflow in one session document. This is an internal storage adapter, not a test-generation workflow.
---

# Playwright Authoring Standalone Adapter

## Responsibility

Persist normalized outputs from the standalone `playwright-authoring` workflow without creating Comet/OpenSpec changes.

This adapter does not analyze requirements, make decisions, plan tests, implement files, or run verification. It only reads and writes the standalone workflow document.

## Session document

Use one file per standalone authoring request:

```text
docs/testing/authoring/<session-id>.md
```

Derive `<session-id>` from a concise, filesystem-safe requirement name. Reuse an explicitly supplied session path when present.

Do not create:

- `openspec/changes/...`;
- `.comet.yaml`;
- Comet phase state;
- `.harness-comet/manifest.json` entries.

## Canonical section order

```md
# Playwright Authoring: <title>

## Requirement

## Playwright Impact Analysis

## Playwright Authoring Decision

## Playwright Authoring Plan

## Playwright Build Result

## Playwright Verification
```

Each stage replaces or appends only its own section. Preserve user-authored content outside managed sections.

## Stage mapping

- `playwright-impact-analysis` → `Playwright Impact Analysis`
- `playwright-authoring-decision` → `Playwright Authoring Decision`
- `playwright-authoring-plan` → `Playwright Authoring Plan`
- `playwright-authoring-build` → `Playwright Build Result`
- `playwright-authoring-verify` → `Playwright Verification`

Render the normalized YAML-like contracts in readable Markdown while preserving every field needed by the next stage.

## Consistency rules

- The standalone document is workflow metadata, not the source of truth for test execution.
- The final Playwright assets must live in the same project-configured paths used by Comet mode.
- Do not alter stage semantics based on storage mode.
- Do not invent a second schema for standalone usage.
- Use the same target operations, boundary classifications, assertions, evidence, and verification outputs as Comet mode.

## Completion conditions

A write is complete only when the requested managed section is present, parseable by the next stage, and no unrelated section was changed.
