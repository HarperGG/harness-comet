---
name: playwright-authoring-build
description: Implement an approved Playwright authoring plan using project conventions and the real application boundary.
---

<!-- Managed by @hapergg/harness-comet. -->

# Playwright Authoring Build

## Responsibility

Implement only the approved Playwright plan and its declared test/support assets.

## Rules

- Exercise the project's real application through its configured Playwright setup.
- Reuse existing fixtures, Page Objects, helpers, factories, data, selectors, and test extensions when appropriate.
- Use deterministic data and controlled external dependencies.
- Use Playwright auto-waiting and web-first assertions.
- Every generated Harness test must include `@harness`.
- Preserve configured reporters and result paths.
- Do not replace an existing product feature with generated HTML or test-authored behavior.
- Map each planned requirement branch to direct assertions.
- Do not add undeclared targets or unrelated coverage.
- If another target is required, return to the decision and planning stages.

## Required output

```yaml
playwrightBuildResult:
  createdFiles: []
  updatedFiles: []
  retiredFiles: []
  reusedAssets: []
  productionBoundary:
    route: ...
    sourcePaths: []
  requirementAssertions: []
  pendingVerification: []
```

Complete only when all implementation targets are ready for `playwright-authoring-verify`.
