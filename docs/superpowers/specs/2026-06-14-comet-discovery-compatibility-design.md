# Comet Discovery And Compatibility Design

## Summary

This spec defines the first Part B sub-project for `harness-comet`:

- detect whether Comet is installed and compatible
- detect project-local Agent platform roots that contain Comet skills
- validate each discovered Skill Root against the PRD contract
- expose a Part B foundation API that later `install`, `doctor`, `diff`, `sync`, and `uninstall` work can build on

This sub-project does **not** patch Comet skills, write manifests, install companion files, bind `verify_command`, or modify any Comet/OpenSpec state.

The output of this sub-project is a read-only discovery and compatibility layer plus CLI diagnostics under `harness-comet comet doctor`.

## Scope

Included:

- Comet CLI/version detection
- Comet package compatibility check against `@rpamis/comet >=0.3.8 <0.4.0`
- project-local Agent platform registry
- Skill Root detection for every supported project-local platform
- required-file contract validation
- stable discovery result types
- read-only CLI diagnostics

Excluded:

- managed patch insertion
- manifest generation
- backup/rollback
- hook commands
- `verify_command` binding
- receipt generation
- archive-check

## Design Goals

1. Part A packages remain isolated from Comet integration logic.
2. Discovery must be read-only and safe to run in any repository.
3. Compatibility errors must be precise enough for a user to fix without reading source.
4. Later Part B commands should reuse one shared discovery model instead of re-implementing path and contract checks.
5. Deleting the future `comet-adapter` package must not affect Part A build/test/run behavior.

## Architecture

Create a new optional package:

```text
packages/comet-adapter/
  src/
    compatibility/
    discovery/
    platforms/
    types.ts
    index.ts
```

Dependency direction:

```text
schema <- sdk <- core <- cli

comet-adapter -> core public API / cli extension surface
```

`comet-adapter` must not be imported by Part A packages. The CLI must only load it inside the `comet` namespace.

## File Responsibilities

Recommended files for this sub-project:

- `packages/comet-adapter/src/types.ts`
  Shared result types and enums for Comet detection, platform targets, and validation issues.

- `packages/comet-adapter/src/platforms/registry.ts`
  Static project-local platform registry matching the PRD table for Comet 0.3.8.

- `packages/comet-adapter/src/platforms/detector.ts`
  Detect platform directories that exist in the target project and derive candidate Skill Roots.

- `packages/comet-adapter/src/discovery/comet-cli.ts`
  Detect `comet` CLI presence and resolve version text.

- `packages/comet-adapter/src/discovery/skill-root.ts`
  Validate one candidate Skill Root against required Comet files.

- `packages/comet-adapter/src/compatibility/version.ts`
  Validate Comet version against the supported semver range.

- `packages/comet-adapter/src/compatibility/file-contract.ts`
  Validate required Skill/Script file existence for each Skill Root.

- `packages/comet-adapter/src/index.ts`
  Public read-only API exports.

- `packages/cli/src/commands/comet.ts`
  CLI entry for `harness-comet comet doctor`, loaded lazily.

The CLI can stay compact by routing `harness-comet comet doctor` into this package and returning exit code `6` for Comet-related incompatibility or absence.

## Public API

The new package should expose these APIs:

```ts
export interface CometCliStatus {
  installed: boolean;
  version?: string;
  supported: boolean;
  supportedRange: string;
  error?: string;
}

export interface AgentPlatformRecord {
  id: string;
  displayName: string;
  platformRoot: string;
  skillRoot: string;
}

export interface SkillRootIssue {
  code:
    | "platform-root-missing"
    | "skill-root-missing"
    | "required-file-missing"
    | "version-unsupported";
  message: string;
  path?: string;
}

export interface SkillRootStatus {
  platformId: string;
  detected: boolean;
  valid: boolean;
  skillRoot: string;
  issues: SkillRootIssue[];
}

export interface CometDiscoveryReport {
  comet: CometCliStatus;
  targets: SkillRootStatus[];
}

export async function detectCometCli(projectRoot: string): Promise<CometCliStatus>;

export function getProjectPlatformRegistry(): AgentPlatformRecord[];

export async function discoverProjectSkillRoots(projectRoot: string): Promise<SkillRootStatus[]>;

export async function buildCometDiscoveryReport(projectRoot: string): Promise<CometDiscoveryReport>;
```

## Platform Registry

The registry must exactly model the PRD project-local roots for the supported Comet baseline. The first implementation should hardcode the PRD table instead of attempting to parse Comet source dynamically.

Required registry entries:

- `claude -> .claude/skills`
- `cursor -> .cursor/skills`
- `codex -> .codex/skills`
- `opencode -> .opencode/skills`
- `windsurf -> .windsurf/skills`
- `cline -> .cline/skills`
- `roocode -> .roo/skills`
- `continue -> .continue/skills`
- `github-copilot -> .github/skills`
- `gemini -> .gemini/skills`
- `amazon-q -> .amazonq/skills`
- `qwen -> .qwen/skills`
- `kilocode -> .kilocode/skills`
- `auggie -> .augment/skills`
- `kiro -> .kiro/skills`
- `kimicode -> .kimi-code/skills`
- `lingma -> .lingma/skills`
- `junie -> .junie/skills`
- `codebuddy -> .codebuddy/skills`
- `costrict -> .cospec/skills`
- `crush -> .crush/skills`
- `factory -> .factory/skills`
- `iflow -> .iflow/skills`
- `pi -> .pi/skills`
- `qoder -> .qoder/skills`
- `antigravity -> .agents/skills`
- `bob -> .bob/skills`
- `forgecode -> .forge/skills`
- `trae -> .trae/skills`

Each detection result should be stable, sorted by `platformId`, and independent of the current shell or editor.

## Skill Root Contract

A Skill Root is valid only when these files all exist:

```text
<root>/comet/SKILL.md
<root>/comet-open/SKILL.md
<root>/comet-design/SKILL.md
<root>/comet-build/SKILL.md
<root>/comet-verify/SKILL.md
<root>/comet-archive/SKILL.md
<root>/comet/scripts/comet-state.sh
<root>/comet/scripts/comet-guard.sh
```

For this first sub-project, file existence is enough. Hash validation belongs to the later patch/install transaction sub-project.

## CLI Behavior

Add a lazy `comet` command group to the existing CLI:

```bash
harness-comet comet doctor
```

Behavior:

- If `comet-adapter` cannot be loaded, return exit code `6`.
- If Comet CLI is missing, print a clear read-only diagnostic and return exit code `6`.
- If Comet version is installed but unsupported, print the discovered version and supported range, then return exit code `6`.
- If Comet is compatible, print every detected platform root and whether its Skill Root is valid.
- If no project-local Agent platform roots are detected, the command still succeeds when Comet itself is compatible; it should report `0 targets found`.

This command must not create directories, patch files, or modify `.comet`, `openspec`, or `.harness-comet`.

## Error Model

Part B discovery continues using exit code `6` for Comet-specific failures:

- Comet CLI missing
- Comet version unsupported
- requested Comet namespace unavailable
- later compatibility-only discovery errors

Read-only contract failures within `comet doctor` should still return `0` when the tool successfully reports diagnostics, unless the failure prevents determining compatibility at all. Missing targets or invalid Skill Roots are diagnostic findings, not command crashes.

Practical rule:

- command execution failure to inspect Comet -> exit `6`
- successful inspection with invalid targets -> exit `0`, report `valid=false`

## Testing Strategy

Unit tests:

- version range parsing
- registry entry count and exact path mapping
- deterministic sort order
- file-contract validation for valid and invalid Skill Roots
- CLI result formatting for missing Comet, unsupported version, valid target, invalid target, and zero-target cases

Contract tests:

- all 29 project-local registry entries exist
- every entry maps to the PRD path exactly
- Skill Root validity requires the exact eight required files

Integration tests:

- temp repo with no `.comet` or Agent platform directories:
  `harness-comet comet doctor` reports missing Comet or zero targets without mutating files
- temp repo with mock platform directories and valid required files:
  detection reports valid targets
- temp repo with partial skill directories:
  detection reports invalid targets and names missing files

Isolation checks:

- Part A commands still pass with `comet-adapter` absent
- removing `packages/comet-adapter` should not break Part A build/test paths

## Acceptance Criteria

This sub-project is complete when:

- `packages/comet-adapter` exists and is only loaded from the CLI `comet` namespace
- `harness-comet comet doctor` can distinguish:
  - Comet missing
  - Comet version unsupported
  - no project-local platform roots
  - project-local roots present but invalid
  - valid project-local Skill Roots
- no command in this sub-project writes to disk
- registry paths match the PRD table exactly
- all new unit and integration tests pass
- Part A commands still pass unchanged

## Assumptions

- The first Part B slice is intentionally read-only.
- The supported baseline remains `@rpamis/comet 0.3.8`.
- Project-local platform roots are the only scope for this slice; global installs are out of scope.
- Hash contracts, markers, manifests, and rollback logic are deferred to the next Part B sub-project.
