# npm Multipackage Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workspace packages publishable to npm while preserving `harness-comet` as the single user install entry point.

**Architecture:** Keep the current pnpm multipackage layout. Publish internal packages as normal npm dependencies and make the CLI package depend on the runtime packages it imports. Use package allowlists and TypeScript test excludes to keep tarballs clean.

**Tech Stack:** pnpm workspace, npm package metadata, TypeScript project references, Vitest.

---

## File Structure

- `packages/*/package.json`: add `files` and `publishConfig` metadata for publishable package tarballs.
- `packages/*/tsconfig.json`: exclude test sources from package builds.
- `packages/cli/src/commands/init.ts`: generate npm version specs for `@harness-comet/playwright`.
- `packages/cli/src/cli.test.ts`: assert Playwright init writes an npm version spec rather than a local `file:` dependency.
- `package.json`: add root scripts for publish dry-run checks.

### Task 1: Playwright init dependency spec

**Files:**

- Modify: `packages/cli/src/cli.test.ts`
- Modify: `packages/cli/src/commands/init.ts`

- [ ] **Step 1: Write the failing test**

Add a test in `packages/cli/src/cli.test.ts` that creates a temporary project, runs the program with `init --mode playwright --skip-install --skip-browsers`, reads the generated `package.json`, and expects `devDependencies["@harness-comet/playwright"]` to equal `"0.1.0"` and not start with `"file:"`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run packages/cli/src/cli.test.ts`

Expected before implementation: the new assertion fails because the current implementation writes a local `file:` dependency.

- [ ] **Step 3: Implement npm version spec resolution**

Update `resolvePlaywrightDependencySpec()` in `packages/cli/src/commands/init.ts` to read the CLI package version from `packages/cli/package.json` relative to `import.meta.url` and return that exact version. The function should throw a clear error if the version cannot be read as a string.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm vitest run packages/cli/src/cli.test.ts`

Expected after implementation: the test passes and the generated dependency is `"0.1.0"`.

### Task 2: Publishable package metadata

**Files:**

- Modify: `packages/adapter-memory/package.json`
- Modify: `packages/adapter-playwright/package.json`
- Modify: `packages/cli/package.json`
- Modify: `packages/comet-adapter/package.json`
- Modify: `packages/core/package.json`
- Modify: `packages/playwright/package.json`
- Modify: `packages/schema/package.json`
- Modify: `packages/sdk/package.json`
- Modify: `package.json`

- [ ] **Step 1: Add package allowlists and publish config**

For every publishable package, add:

```json
"files": ["dist", "package.json"],
"publishConfig": {
  "access": "public"
}
```

For `packages/cli/package.json`, use:

```json
"files": ["bin", "dist", "package.json"],
"publishConfig": {
  "access": "public"
}
```

- [ ] **Step 2: Add root dry-run scripts**

Add root scripts:

```json
"pack:dry-run": "pnpm -r --filter './packages/*' exec npm pack --dry-run",
"release:check": "pnpm build && pnpm test && pnpm pack:dry-run"
```

- [ ] **Step 3: Validate package metadata parses**

Run: `node -e "for (const f of ['packages/schema/package.json','packages/sdk/package.json','packages/core/package.json','packages/adapter-memory/package.json','packages/adapter-playwright/package.json','packages/playwright/package.json','packages/comet-adapter/package.json','packages/cli/package.json']) JSON.parse(require('fs').readFileSync(f,'utf8')); console.log('package metadata ok')"`

Expected: prints `package metadata ok`.

### Task 3: Exclude tests from package builds

**Files:**

- Modify: `packages/adapter-memory/tsconfig.json`
- Modify: `packages/adapter-playwright/tsconfig.json`
- Modify: `packages/cli/tsconfig.json`
- Modify: `packages/comet-adapter/tsconfig.json`
- Modify: `packages/core/tsconfig.json`
- Modify: `packages/playwright/tsconfig.json`
- Modify: `packages/schema/tsconfig.json`
- Modify: `packages/sdk/tsconfig.json`

- [ ] **Step 1: Add TypeScript excludes**

For every publishable package `tsconfig.json`, add:

```json
"exclude": ["src/**/*.test.ts", "src/**/__tests__/**"]
```

- [ ] **Step 2: Clean and rebuild**

Run: `find packages -maxdepth 2 -type d -name dist -prune -exec rm -rf {} + && find packages -maxdepth 2 -type f -name tsconfig.tsbuildinfo -delete && pnpm build`

Expected: TypeScript builds all packages successfully and `dist` no longer contains compiled test files.

- [ ] **Step 3: Confirm no compiled tests remain**

Run: `find packages -path '*dist*' -name '*.test.js'`

Expected: no output.

### Task 4: Release verification

**Files:**

- Read: generated npm pack output

- [ ] **Step 1: Run full tests**

Run: `pnpm test`

Expected: test suite exits 0.

- [ ] **Step 2: Run dry-run pack checks**

Run: `pnpm pack:dry-run`

Expected: all publishable packages produce dry-run output without including `src`, `*.test.*`, or `tsconfig.tsbuildinfo`.

- [ ] **Step 3: Simulate CLI tarball install**

Run:

```bash
rm -rf /tmp/harness-comet-publish-check
mkdir -p /tmp/harness-comet-publish-check/pack /tmp/harness-comet-publish-check/app
pnpm --dir packages/cli pack --pack-destination /tmp/harness-comet-publish-check/pack
cd /tmp/harness-comet-publish-check/app
npm init -y
npm install ../pack/harness-comet-0.1.0.tgz --ignore-scripts
npx harness-comet --help
```

Expected: install resolves dependencies from npm-compatible package metadata and `npx harness-comet --help` prints CLI usage. If internal packages are not published yet, inspect the packed `package.json` instead and use `npm install --package-lock-only` failure as expected prepublish evidence.
