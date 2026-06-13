# Part A Acceptance

Date: 2026-06-13

## Environment

- Node.js: v24.16.0
- pnpm: 8.6.12
- Scope: Part A only. No Comet adapter package, Skill patch, Hook, Manifest, Verify Receipt, CI gate, dashboard, or persistent Harness report is implemented.

## Verified Commands

```bash
pnpm install
pnpm setup:browsers   # required for Playwright runtime acceptance
pnpm build
pnpm test
pnpm lint
```

Result: PASS.

## Memory Demo

Verified in a clean temporary directory:

```bash
node packages/cli/bin/harness-comet.js --root "$TMP" init --adapter memory --yes
node packages/cli/bin/harness-comet.js --root "$TMP" validate
node packages/cli/bin/harness-comet.js --root "$TMP" scenario list
node packages/cli/bin/harness-comet.js --root "$TMP" run --scenario example-smoke
node packages/cli/bin/harness-comet.js --root "$TMP" --json run --scenario example-smoke
```

Result: PASS. JSON stdout is a single `RunResultV1` object.

Failure check:

```bash
# Change expected from "Hello Harness" to "Goodbye Harness"
node packages/cli/bin/harness-comet.js --root "$TMP" run --scenario example-smoke
```

Result: FAIL with exit code `1` and a `value-mismatch` difference.

## Playwright Demo

Verified:

```bash
node packages/cli/bin/harness-comet.js --root "$TMP" init --adapter playwright --yes
node packages/cli/bin/harness-comet.js --root "$TMP" doctor
node packages/cli/bin/harness-comet.js --root "$TMP" validate
node packages/cli/bin/harness-comet.js --root "$TMP" run --scenario example-smoke
```

Result: PASS.

Failure check:

```bash
# Change expected from "Hello Harness" to "Goodbye Harness"
node packages/cli/bin/harness-comet.js --root "$TMP" run --scenario example-smoke
```

Result: FAIL with exit code `1` and a `value-mismatch` difference.

The workspace now exposes a dedicated install command:

```bash
pnpm setup:browsers
```

`harness-comet doctor` also reports whether the Playwright browser executable is complete enough for runtime use.

## Part A Independence

The clean temporary acceptance directories did not contain `.comet/`, `openspec/`, or Agent Skill directories. The following Part A commands worked without Comet:

- `init`
- `validate`
- `scenario list`
- `run`

The `harness-comet comet` namespace is a Part B placeholder only and returns exit code `6` without loading any Comet implementation.
