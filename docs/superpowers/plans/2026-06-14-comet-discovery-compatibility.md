# Comet Discovery And Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first read-only Part B foundation for detecting Comet, validating project-local Skill Roots, and exposing `harness-comet comet doctor` without changing any project files.

**Architecture:** Add an optional `packages/comet-adapter` package that owns Comet-specific discovery, compatibility checks, and result types. Extend the CLI with a lazily loaded `comet` namespace so Part A stays isolated and all Comet-facing logic is reused by later install/patch/verify work.

**Tech Stack:** TypeScript, ESM, pnpm workspace, Commander, Vitest, existing Part A CLI/core packages

---

### Task 1: Scaffold `comet-adapter` Package

**Files:**

- Create: `packages/comet-adapter/package.json`
- Create: `packages/comet-adapter/tsconfig.json`
- Create: `packages/comet-adapter/src/index.ts`
- Modify: `tsconfig.json`
- Test: `pnpm build`

- [ ] **Step 1: Write the failing workspace build expectation**

Add `packages/comet-adapter` to the root TS references and create the empty package entry so `pnpm build` expects the package to exist.

```json
{
  "references": [
    { "path": "./packages/schema" },
    { "path": "./packages/sdk" },
    { "path": "./packages/core" },
    { "path": "./packages/adapter-memory" },
    { "path": "./packages/adapter-playwright" },
    { "path": "./packages/comet-adapter" },
    { "path": "./packages/cli" }
  ]
}
```

- [ ] **Step 2: Run build to verify the package is missing**

Run:

```bash
pnpm build
```

Expected: FAIL because `packages/comet-adapter` is referenced but not fully defined.

- [ ] **Step 3: Create the minimal package scaffold**

Create the package metadata and TS config:

```json
{
  "name": "@harness-comet/comet-adapter",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -b",
    "test": "vitest run"
  },
  "dependencies": {
    "@harness-comet/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vitest": "^4.0.14"
  }
}
```

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "references": [{ "path": "../core" }],
  "include": ["src/**/*.ts"]
}
```

Create a minimal export:

```ts
export {};
```

- [ ] **Step 4: Run build to verify the scaffold passes**

Run:

```bash
pnpm build
```

Expected: PASS for workspace compilation with the new package present.

### Task 2: Add Shared Discovery Types And Platform Registry

**Files:**

- Create: `packages/comet-adapter/src/types.ts`
- Create: `packages/comet-adapter/src/platforms/registry.ts`
- Modify: `packages/comet-adapter/src/index.ts`
- Test: `packages/comet-adapter/src/platforms/registry.test.ts`

- [ ] **Step 1: Write failing tests for registry entry count and exact paths**

Create tests that assert:

- registry length is `29`
- `codex` maps to `.codex/skills`
- `claude` maps to `.claude/skills`
- `antigravity` maps to `.agents/skills`
- results are stable and sorted by `id`

```ts
import { describe, expect, it } from "vitest";
import { getProjectPlatformRegistry } from "./registry.js";

describe("platform registry", () => {
  it("matches the PRD table exactly", () => {
    const registry = getProjectPlatformRegistry();
    expect(registry).toHaveLength(29);
    expect(registry.find((item) => item.id === "codex")).toMatchObject({
      id: "codex",
      platformRoot: ".codex",
      skillRoot: ".codex/skills"
    });
  });
});
```

- [ ] **Step 2: Run the package test to verify it fails**

Run:

```bash
pnpm --filter @harness-comet/comet-adapter test -- registry
```

Expected: FAIL because the registry and shared types do not exist yet.

- [ ] **Step 3: Implement shared types and hardcoded registry**

Create `types.ts` with:

- `CometCliStatus`
- `AgentPlatformRecord`
- `SkillRootIssue`
- `SkillRootStatus`
- `CometDiscoveryReport`

Create `registry.ts` with a constant array containing the 29 exact PRD entries, sorted by `id`.

- [ ] **Step 4: Export the registry from package index**

Update `src/index.ts`:

```ts
export * from "./types.js";
export * from "./platforms/registry.js";
```

- [ ] **Step 5: Run tests to verify registry coverage passes**

Run:

```bash
pnpm --filter @harness-comet/comet-adapter test -- registry
```

Expected: PASS.

### Task 3: Implement Comet CLI Version Detection

**Files:**

- Create: `packages/comet-adapter/src/discovery/comet-cli.ts`
- Create: `packages/comet-adapter/src/compatibility/version.ts`
- Modify: `packages/comet-adapter/src/index.ts`
- Test: `packages/comet-adapter/src/discovery/comet-cli.test.ts`

- [ ] **Step 1: Write failing tests for version parsing and compatibility**

Add tests for:

- missing CLI output -> `installed=false`, `supported=false`
- `0.3.8` -> supported
- `0.4.0` -> unsupported
- garbage version output -> unsupported with error

```ts
expect(isSupportedCometVersion("0.3.8")).toBe(true);
expect(isSupportedCometVersion("0.4.0")).toBe(false);
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @harness-comet/comet-adapter test -- comet-cli
```

Expected: FAIL because detection and semver checks do not exist.

- [ ] **Step 3: Implement version compatibility helper**

Implement:

```ts
export const SUPPORTED_COMET_RANGE = ">=0.3.8 <0.4.0";
export function isSupportedCometVersion(version: string): boolean;
```

The first implementation can parse semver numerically without adding a new library.

- [ ] **Step 4: Implement CLI discovery**

Detect Comet using a read-only child process:

```ts
const result = await execa("comet", ["--version"], { cwd: projectRoot, reject: false });
```

Map outputs into `CometCliStatus`.

- [ ] **Step 5: Re-run tests**

Run:

```bash
pnpm --filter @harness-comet/comet-adapter test -- comet-cli
```

Expected: PASS.

### Task 4: Implement Skill Root Contract Validation

**Files:**

- Create: `packages/comet-adapter/src/compatibility/file-contract.ts`
- Create: `packages/comet-adapter/src/discovery/skill-root.ts`
- Test: `packages/comet-adapter/src/discovery/skill-root.test.ts`

- [ ] **Step 1: Write failing tests for valid and invalid Skill Roots**

Test:

- full required file set -> `valid=true`
- missing `comet-verify/SKILL.md` -> `valid=false`
- missing `comet/scripts/comet-guard.sh` -> `valid=false`

```ts
expect(report.valid).toBe(false);
expect(report.issues[0]?.code).toBe("required-file-missing");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @harness-comet/comet-adapter test -- skill-root
```

Expected: FAIL because file-contract validation is not implemented.

- [ ] **Step 3: Implement required-file contract validation**

Use the exact eight required files from the spec and PRD. Return one `SkillRootIssue` per missing file.

- [ ] **Step 4: Implement one-root validation helper**

Create a function that accepts:

- `platformId`
- `skillRoot`

And returns `SkillRootStatus`.

- [ ] **Step 5: Re-run the tests**

Run:

```bash
pnpm --filter @harness-comet/comet-adapter test -- skill-root
```

Expected: PASS.

### Task 5: Implement Project Skill Root Discovery Report

**Files:**

- Create: `packages/comet-adapter/src/platforms/detector.ts`
- Modify: `packages/comet-adapter/src/index.ts`
- Test: `packages/comet-adapter/src/platforms/detector.test.ts`

- [ ] **Step 1: Write failing tests for project-local target discovery**

Cover:

- zero targets in an empty repo
- one valid `codex` target
- one invalid `cursor` target with missing files
- sorted multi-target output

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm --filter @harness-comet/comet-adapter test -- detector
```

Expected: FAIL because discovery is not implemented.

- [ ] **Step 3: Implement project-root scanning**

For each registry entry:

- check whether `platformRoot` exists
- if yes, validate the `skillRoot`
- if not, skip from detected targets

Expose:

```ts
export async function discoverProjectSkillRoots(projectRoot: string): Promise<SkillRootStatus[]>;
```

- [ ] **Step 4: Implement the full report builder**

Compose:

- `detectCometCli(projectRoot)`
- `discoverProjectSkillRoots(projectRoot)`

Into:

```ts
export async function buildCometDiscoveryReport(projectRoot: string): Promise<CometDiscoveryReport>;
```

- [ ] **Step 5: Re-run the tests**

Run:

```bash
pnpm --filter @harness-comet/comet-adapter test -- detector
```

Expected: PASS.

### Task 6: Add Lazy `harness-comet comet doctor` CLI

**Files:**

- Create: `packages/cli/src/commands/comet.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `test/comet-doctor.integration.test.ts`

- [ ] **Step 1: Write failing CLI integration tests**

Cover:

- `comet-adapter` missing or load failure -> exit `6`
- Comet missing -> exit `6`
- Comet compatible with zero targets -> exit `0`
- invalid target -> exit `0` with `valid=false` in output

- [ ] **Step 2: Run the new integration tests to verify failure**

Run:

```bash
pnpm test -- test/comet-doctor.integration.test.ts
```

Expected: FAIL because the CLI only has a placeholder `comet` command today.

- [ ] **Step 3: Implement the lazy command handler**

Create `commands/comet.ts` that dynamically imports `@harness-comet/comet-adapter` and renders a read-only report.

Handle command outcomes:

- hard inspection failure -> exit `6`
- successful diagnostics -> exit `0`

- [ ] **Step 4: Wire the command group into the root CLI**

Replace the placeholder `comet` action with a command group exposing:

```bash
harness-comet comet doctor
```

Do not add install/sync/diff/uninstall yet.

- [ ] **Step 5: Re-run the integration tests**

Run:

```bash
pnpm test -- test/comet-doctor.integration.test.ts
```

Expected: PASS.

### Task 7: Add Part A Isolation Guards

**Files:**

- Modify: `test/cli.integration.test.ts`
- Create: `test/comet-isolation.integration.test.ts`

- [ ] **Step 1: Write failing isolation coverage**

Add tests that prove:

- Part A `init`, `validate`, and `run` still work without invoking Comet code
- a simulated Comet namespace failure does not break Part A commands

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pnpm test -- test/comet-isolation.integration.test.ts
```

Expected: FAIL until the new isolation checks are implemented.

- [ ] **Step 3: Implement the isolation tests**

Use temp projects and command-level assertions only. Do not mutate existing Part A package boundaries.

- [ ] **Step 4: Re-run the isolation tests**

Run:

```bash
pnpm test -- test/comet-isolation.integration.test.ts
```

Expected: PASS.

### Task 8: Final Verification

**Files:**

- Modify: `docs/superpowers/specs/2026-06-14-comet-discovery-compatibility-design.md` only if implementation reality requires a spec correction

- [ ] **Step 1: Run targeted comet-adapter tests**

Run:

```bash
pnpm --filter @harness-comet/comet-adapter test
```

Expected: PASS.

- [ ] **Step 2: Run CLI integration tests**

Run:

```bash
pnpm test -- test/comet-doctor.integration.test.ts
pnpm test -- test/comet-isolation.integration.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full workspace verification**

Run:

```bash
pnpm build
pnpm test
pnpm lint
pnpm format
```

Expected: PASS.

- [ ] **Step 4: Run manual smoke commands**

Run:

```bash
pnpm harness-comet comet doctor
pnpm harness-comet --root examples/memory-demo run --scenario example-smoke
pnpm harness-comet --root examples/playwright-demo run --scenario example-smoke
```

Expected:

- `comet doctor` reports read-only Comet diagnostics
- both Part A demos still pass unchanged
