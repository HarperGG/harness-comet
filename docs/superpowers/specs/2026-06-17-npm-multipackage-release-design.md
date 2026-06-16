# Harness Comet npm Multipackage Release Design

## Goal

Prepare Harness Comet for public npm release as a multipackage pnpm workspace where `harness-comet` is the user-facing CLI package and `@harness-comet/*` packages are published dependencies.

## Publishing Model

`harness-comet` remains the install entry point. Its `dependencies` include the internal runtime packages required by CLI commands, so package managers automatically install those packages when users install `harness-comet`.

The workspace publishes these packages with the same version:

- `harness-comet`
- `@harness-comet/schema`
- `@harness-comet/sdk`
- `@harness-comet/core`
- `@harness-comet/adapter-memory`
- `@harness-comet/adapter-playwright`
- `@harness-comet/playwright`
- `@harness-comet/comet-adapter`

The root workspace package remains private and is not published.

## Package Contents

Each publishable package should use a `files` allowlist so npm tarballs contain only publishable runtime artifacts:

- `dist`
- `bin` for the CLI package
- `package.json`
- optional `README.md` and `LICENSE` files when present

TypeScript test sources should remain in the repository but should not be compiled into `dist`. Package `tsconfig.json` files should exclude `src/**/*.test.ts` and `src/**/__tests__/**`.

## Playwright Init Behavior

`harness-comet init --mode playwright` generates a target project that depends on `@harness-comet/playwright` for the Playwright reporter. The generated dependency must be an npm version spec matching the CLI package version, not a monorepo-local `file:` path. This keeps generated projects installable after `harness-comet` is installed from npm.

For the current release, the generated spec should be the exact package version, for example `0.1.0`. Exact versions keep the CLI and reporter package aligned across the monorepo release.

## Release Checks

Before publishing:

- Run the workspace build.
- Run the test suite.
- Run npm or pnpm pack dry-runs for publishable packages.
- Inspect tarball contents to confirm tests, source files, and TypeScript build info are not included.
- Simulate installing the CLI package tarball in a temporary project and run `harness-comet --help`.

## User Installation

Published users should be able to run:

```bash
npm install -D harness-comet
npx harness-comet --help
npx harness-comet init --mode playwright
```

The equivalent pnpm flow should be:

```bash
pnpm add -D harness-comet
pnpm exec harness-comet --help
pnpm exec harness-comet init --mode playwright
```
