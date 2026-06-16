# Harness-Comet npm Scope Migration and Publish Readiness Plan

> npm owner: `hapergg`
>
> Target npm scope: `@hapergg`
>
> Target release: `0.1.0`

## Goal

Migrate all publishable packages from the unavailable `@harness-comet/*` scope to packages owned by `hapergg`, make the monorepo safe to pack and publish to npm, and prove that a clean consumer project can install the CLI, initialize Playwright mode, resolve the custom reporter, validate the generated project, and run the generated example.

## Non-goals

- Do not redesign Runtime mode behavior.
- Do not redesign the Comet lifecycle or phase semantics.
- Do not publish before the tarball consumer test passes.
- Do not use `registry.npmmirror.com` for publishing.

## Target Package Names

Use the following package names consistently:

| Workspace directory | Current name | Target npm name |
|---|---|---|
| `packages/schema` | `@harness-comet/schema` | `@hapergg/harness-comet-schema` |
| `packages/sdk` | `@harness-comet/sdk` | `@hapergg/harness-comet-sdk` |
| `packages/core` | `@harness-comet/core` | `@hapergg/harness-comet-core` |
| `packages/playwright` | `@harness-comet/playwright` | `@hapergg/harness-comet-playwright` |
| `packages/comet-adapter` | `@harness-comet/comet-adapter` | `@hapergg/harness-comet-comet-adapter` |
| `packages/adapter-memory` | `@harness-comet/adapter-memory` | `@hapergg/harness-comet-adapter-memory` |
| `packages/adapter-playwright` | `@harness-comet/adapter-playwright` | `@hapergg/harness-comet-adapter-playwright` |
| `packages/cli` | `harness-comet` | `@hapergg/harness-comet-cli` |

The CLI package must continue exporting this executable name:

```json
{
  "bin": {
    "harness-comet": "./bin/harness-comet.js"
  }
}
```

Consumers will install:

```bash
pnpm add -D @hapergg/harness-comet-cli
```

and invoke:

```bash
pnpm exec harness-comet
```

---

## Phase 1: Rename Workspace Packages and Internal Imports

### Task 1.1: Update all package names

Modify every publishable package manifest to use the target names above.

Keep all internal dependency ranges as `workspace:*` inside the monorepo. pnpm will rewrite these ranges to concrete versions during `pack` and `publish`.

Example:

```json
{
  "dependencies": {
    "@hapergg/harness-comet-schema": "workspace:*"
  }
}
```

Do not use `file:../schema` in committed package manifests.

### Task 1.2: Update TypeScript imports and dynamic imports

Replace all source imports, type imports, dynamic imports, adapter package strings, and test mocks.

Required mappings:

```text
@harness-comet/schema              -> @hapergg/harness-comet-schema
@harness-comet/sdk                 -> @hapergg/harness-comet-sdk
@harness-comet/core                -> @hapergg/harness-comet-core
@harness-comet/playwright          -> @hapergg/harness-comet-playwright
@harness-comet/comet-adapter       -> @hapergg/harness-comet-comet-adapter
@harness-comet/adapter-memory      -> @hapergg/harness-comet-adapter-memory
@harness-comet/adapter-playwright  -> @hapergg/harness-comet-adapter-playwright
```

Search locations include:

- `packages/**/src/**/*.ts`
- `packages/**/package.json`
- `test/**/*.ts`
- `examples/**`
- `vitest.config.ts`
- root `package.json`
- generated template strings
- Comet install assets and skill text

### Task 1.3: Update generated project templates

Update Playwright reporter template:

```ts
reporter: [
  ["list"],
  ["html", { open: "never" }],
  ["@hapergg/harness-comet-playwright/reporter"]
]
```

Update Runtime adapter template strings:

```text
@hapergg/harness-comet-adapter-memory
@hapergg/harness-comet-adapter-playwright
```

### Acceptance checks

```bash
rg '@harness-comet/' packages test examples vitest.config.ts package.json pnpm-lock.yaml
```

Expected: no active code or manifest references.

Historical design documents may retain old names only when explicitly describing past state.

---

## Phase 2: Standardize Publishable Package Manifests

### Task 2.1: Add common npm metadata

Every publishable package must contain:

```json
{
  "version": "0.1.0",
  "license": "MIT",
  "engines": {
    "node": ">=20"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/HarperGG/harness-comet.git",
    "directory": "packages/<package-directory>"
  },
  "homepage": "https://github.com/HarperGG/harness-comet#readme",
  "bugs": {
    "url": "https://github.com/HarperGG/harness-comet/issues"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org/"
  }
}
```

Add a meaningful `description` per package.

### Task 2.2: Restrict published files

Library packages:

```json
{
  "files": ["dist"]
}
```

CLI package:

```json
{
  "files": ["dist", "bin"]
}
```

Do not list `package.json`; npm always includes it.

### Task 2.3: Add canonical entry points

For single-entry libraries:

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  }
}
```

### Task 2.4: Harden Playwright exports

`packages/playwright/package.json` must export:

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./reporter": {
      "types": "./dist/reporter.d.ts",
      "import": "./dist/reporter.js",
      "default": "./dist/reporter.js"
    },
    "./list-reporter": {
      "types": "./dist/list-reporter.d.ts",
      "import": "./dist/list-reporter.js",
      "default": "./dist/list-reporter.js"
    }
  }
}
```

Add Playwright as both peer and development dependency:

```json
{
  "peerDependencies": {
    "@playwright/test": "^1.60.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.60.0"
  }
}
```

### Task 2.5: Add clean, build, and prepack scripts

Every publishable package:

```json
{
  "scripts": {
    "clean": "rm -rf dist tsconfig.tsbuildinfo",
    "build": "tsc -b",
    "test": "vitest run",
    "prepack": "pnpm clean && pnpm build"
  }
}
```

Preserve package-specific test configuration where required.

For Playwright package, prepack must verify files:

```json
{
  "prepack": "pnpm clean && pnpm build && test -f dist/index.js && test -f dist/reporter.js && test -f dist/list-reporter.js"
}
```

For CLI package:

```json
{
  "prepack": "pnpm clean && pnpm build && test -f dist/index.js && test -f bin/harness-comet.js"
}
```

---

## Phase 3: Make CLI Initialization npm-safe

### Task 3.1: Stop writing local `file:` dependencies

Remove source-workspace path resolution from `packages/cli/src/commands/init.ts`.

Delete logic equivalent to:

```ts
return `file:${localPackagePath}`;
```

Generated consumer projects must receive:

```json
{
  "devDependencies": {
    "@hapergg/harness-comet-playwright": "^0.1.0",
    "@playwright/test": "^1.60.0"
  }
}
```

### Task 3.2: Introduce a shared package identity/version module

Create a small source module, for example:

```ts
// packages/cli/src/package-info.ts
export const HARNESS_COMET_VERSION = "0.1.0";
export const HARNESS_COMET_PLAYWRIGHT_PACKAGE =
  "@hapergg/harness-comet-playwright";
```

Use it in init templates and tests. Avoid repeating package names and versions in multiple files.

Before future releases, Changesets or the release script must update this version together with package manifests.

### Task 3.3: Do not modify consumer peerDependencies

Remove logic that adds `@playwright/test` to the target project's `peerDependencies`.

Only write to `devDependencies`.

### Task 3.4: Fail clearly on dependency installation errors

`installProjectDependencies` must throw a typed error rather than return `false` silently.

Required behavior:

- generated files may remain on disk;
- command exits non-zero;
- message states that asset creation succeeded but dependency installation failed;
- message includes the package manager command to retry.

Suggested error code:

```text
PLAYWRIGHT_DEPENDENCY_INSTALL_FAILED
```

### Task 3.5: Fail clearly on browser installation errors

Do not print overall success after Chromium installation fails.

Suggested error code:

```text
PLAYWRIGHT_BROWSER_INSTALL_FAILED
```

Hint:

```text
Run: pnpm exec playwright install chromium
```

### Acceptance checks

Generated consumer `package.json` contains no:

```text
file:/
workspace:*
@harness-comet/
```

---

## Phase 4: Update Tests and Examples

### Task 4.1: Update unit tests

Update assertions for:

- target package names;
- reporter module path;
- generated dependencies;
- no generated peer dependency;
- install failure exit behavior.

### Task 4.2: Update integration tests

Update all test fixtures and temporary package manifests to `@hapergg/*` package names.

Add regression coverage for the two observed failures:

1. external project must not receive a package with unresolved `workspace:*` references;
2. `@hapergg/harness-comet-playwright/reporter` must resolve from an installed artifact.

### Task 4.3: Update examples

Update:

- `examples/playwright-demo`
- `examples/memory-demo`
- generated configs
- README commands

Examples must use published package names, not workspace-only aliases.

---

## Phase 5: Add Pack Artifact Verification

### Task 5.1: Add a package verification script

Create `scripts/verify-packed-package.mjs` or equivalent.

It must verify:

- expected files exist in tarball;
- exported paths point to files in tarball;
- no dependency contains `workspace:` or `file:`;
- package name matches `@hapergg/*`;
- `publishConfig.registry` is npmjs;
- CLI tarball includes executable bin.

### Task 5.2: Add root pack scripts

Root `package.json` should include:

```json
{
  "scripts": {
    "clean": "pnpm -r clean",
    "build": "pnpm -r build",
    "release:check": "pnpm clean && pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm lint",
    "pack:all": "node scripts/pack-all.mjs",
    "test:consumer": "node scripts/test-packed-consumer.mjs"
  }
}
```

### Task 5.3: Build all tarballs in dependency order

Required order:

```text
schema
sdk
core
playwright
adapter-memory
adapter-playwright
comet-adapter
cli
```

Output to:

```text
artifacts/npm/
```

### Task 5.4: Inspect packed manifests

For each tarball, assert pnpm converted internal dependencies from:

```json
"workspace:*"
```

to:

```json
"0.1.0"
```

---

## Phase 6: Add a Clean Consumer Test

### Task 6.1: Create a temporary consumer project

The test must:

1. create a temporary directory;
2. run `pnpm init`;
3. install all required tarballs;
4. verify CLI bin availability;
5. resolve Playwright reporter subpath;
6. initialize Playwright mode;
7. install generated dependencies from tarballs or a controlled local registry;
8. run Playwright test collection;
9. run Harness validation;
10. run the generated example.

### Task 6.2: Required commands

Reporter resolution:

```bash
node --input-type=module -e \
  "console.log(import.meta.resolve('@hapergg/harness-comet-playwright/reporter'))"
```

CLI resolution:

```bash
pnpm exec harness-comet --help
```

Initialization:

```bash
pnpm exec harness-comet init \
  --mode playwright \
  --test-dir tests/harness \
  --skip-browsers \
  --yes
```

Validation:

```bash
pnpm exec playwright test --list
pnpm exec harness-comet validate
```

### Task 6.3: Consumer test acceptance criteria

The consumer test passes only when:

- package install succeeds without workspace errors;
- reporter subpath resolves;
- generated package manifest uses `@hapergg/harness-comet-playwright`;
- generated manifest contains no local absolute paths;
- `harness-comet validate` succeeds;
- generated example test is collected;
- generated results file is produced after execution.

---

## Phase 7: Prepare npm Authentication and Release

### Task 7.1: Confirm account and registry

```bash
npm whoami --registry=https://registry.npmjs.org/
```

Expected:

```text
hapergg
```

Confirm registry:

```bash
npm config get registry
```

Expected:

```text
https://registry.npmjs.org/
```

### Task 7.2: Confirm package names are available

Run for every package:

```bash
npm view @hapergg/harness-comet-schema \
  --registry=https://registry.npmjs.org/
```

A `404` before first publish is expected and indicates the name is currently unused under the account scope.

### Task 7.3: Run dry-run publish

```bash
pnpm --filter @hapergg/harness-comet-schema publish \
  --dry-run \
  --access public \
  --registry=https://registry.npmjs.org/
```

Repeat for all publishable packages.

### Task 7.4: Publish in dependency order

```bash
pnpm --filter @hapergg/harness-comet-schema publish --access public --registry=https://registry.npmjs.org/
pnpm --filter @hapergg/harness-comet-sdk publish --access public --registry=https://registry.npmjs.org/
pnpm --filter @hapergg/harness-comet-core publish --access public --registry=https://registry.npmjs.org/
pnpm --filter @hapergg/harness-comet-playwright publish --access public --registry=https://registry.npmjs.org/
pnpm --filter @hapergg/harness-comet-adapter-memory publish --access public --registry=https://registry.npmjs.org/
pnpm --filter @hapergg/harness-comet-adapter-playwright publish --access public --registry=https://registry.npmjs.org/
pnpm --filter @hapergg/harness-comet-comet-adapter publish --access public --registry=https://registry.npmjs.org/
pnpm --filter @hapergg/harness-comet-cli publish --access public --registry=https://registry.npmjs.org/
```

Do not publish the CLI until every dependency is visible from npm.

Verify each published package:

```bash
npm view <package-name> version --registry=https://registry.npmjs.org/
```

---

## Phase 8: Verify the Real npm Consumer Experience

Create a brand-new directory and install only from npm:

```bash
TEMP_DIR="$(mktemp -d)"
cd "$TEMP_DIR"
pnpm init
pnpm add -D @hapergg/harness-comet-cli
pnpm exec harness-comet --help
pnpm exec harness-comet init --mode playwright --yes
pnpm exec harness-comet validate
pnpm exec harness-comet run
```

Resolve the reporter:

```bash
node --input-type=module -e \
  "console.log(import.meta.resolve('@hapergg/harness-comet-playwright/reporter'))"
```

This real-registry test is the release gate.

---

## Phase 9: Versioning and Release Automation

### Task 9.1: Add Changesets

```bash
pnpm add -Dw @changesets/cli
pnpm changeset init
```

Use a fixed group initially so all public packages share one version:

```json
{
  "fixed": [
    [
      "@hapergg/harness-comet-schema",
      "@hapergg/harness-comet-sdk",
      "@hapergg/harness-comet-core",
      "@hapergg/harness-comet-playwright",
      "@hapergg/harness-comet-comet-adapter",
      "@hapergg/harness-comet-adapter-memory",
      "@hapergg/harness-comet-adapter-playwright",
      "@hapergg/harness-comet-cli"
    ]
  ],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch"
}
```

### Task 9.2: Add release scripts

```json
{
  "scripts": {
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm release:check && pnpm pack:all && pnpm test:consumer && changeset publish"
  }
}
```

### Task 9.3: Prevent republishing the same version

If a published `0.1.0` package is defective, bump to `0.1.1`. npm package name/version pairs cannot be reused.

---

## Final Release Checklist

- [ ] `npm whoami` returns `hapergg`.
- [ ] All package names use `@hapergg/*`.
- [ ] No active `@harness-comet/*` references remain.
- [ ] No committed `file:` dependencies exist between publishable packages.
- [ ] Internal monorepo dependencies use `workspace:*`.
- [ ] Every public package has npm metadata, `files`, `publishConfig`, and `prepack`.
- [ ] Playwright package exports `./reporter` and `./list-reporter`.
- [ ] Playwright tarball includes all reporter JavaScript and declaration files.
- [ ] CLI tarball includes executable `bin/harness-comet.js`.
- [ ] CLI init writes `@hapergg/harness-comet-playwright@^0.1.0`.
- [ ] CLI init does not write consumer peer dependencies.
- [ ] Install failures exit non-zero and do not report full success.
- [ ] Build, tests, lint, and dry-run publish pass.
- [ ] Packed tarballs contain no `workspace:` or local `file:` dependency references.
- [ ] Clean tarball consumer test passes.
- [ ] Packages are published in dependency order.
- [ ] Clean npm-registry consumer test passes.

## Definition of Done

The migration is complete when a user with no local Harness-Comet checkout can run:

```bash
pnpm add -D @hapergg/harness-comet-cli
pnpm exec harness-comet init --mode playwright --yes
pnpm exec harness-comet validate
pnpm exec harness-comet run
```

without workspace resolution errors, local path dependencies, missing reporter exports, or partial-success installation messages.
