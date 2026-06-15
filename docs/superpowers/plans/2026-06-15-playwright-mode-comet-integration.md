# Playwright Mode Comet Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `mode: "playwright"` project mode that uses official Playwright tests as the execution model while Harness-Comet provides business scenario metadata, Comet phase governance, impact decisions, verification evidence, and archive records.

**Architecture:** Keep the existing `mode: "runtime"` Harness flow intact and introduce a separate Playwright-mode path selected at configuration load time. Runtime mode continues using Scenario / Fixture / Adapter / Inspector / Oracle / Runner; Playwright mode uses `playwright.config.ts`, `@playwright/test`, lightweight Harness scenario metadata, and Comet hook validation. Both modes share the CLI entrypoint but dispatch to separate handlers after loading `harness-comet.config.ts`.

**Tech Stack:** TypeScript, ESM, pnpm workspace, Commander, Vitest, Zod, Playwright, existing `@harness-comet/schema`, `@harness-comet/core`, `@harness-comet/cli`, and `@harness-comet/comet-adapter`.

---

## Non-Negotiable Product Decisions

- New official config file name is `harness-comet.config.ts`.
- `harness.config.ts` is not supported by the new implementation path. Existing examples and tests must migrate to `harness-comet.config.ts`.
- Runtime mode and Playwright mode must remain isolated.
- `mode: "runtime"` must not depend on Playwright-mode metadata, Playwright helper packages, or Playwright runner code.
- `mode: "playwright"` must not use YAML Scenario / Fixture / Adapter / Inspector / Oracle / Runner.
- Playwright mode initialization must be minimal.
- Playwright mode must not hard-code `pages`, `drivers`, `api`, `data`, `journeys`, or `regression` directories.
- Directory categories may appear in docs as optional examples only, never as schema requirements or hard validation rules.
- Playwright execution configuration stays in `playwright.config.ts`.
- Harness-Comet governance configuration stays in `harness-comet.config.ts`.
- Comet phase hooks must branch by mode and validate mode-specific sections.
- Playwright mode initialization must ensure the target project has `@playwright/test`, `@harness-comet/playwright`, and Chromium installed. If the target project already has Playwright, reuse the project-owned version.

## Target User Experience

Runtime mode:

```bash
harness-comet init --mode runtime --adapter memory
harness-comet validate
harness-comet run --scenario example-smoke
```

Playwright mode:

```bash
harness-comet init --mode playwright
harness-comet validate
harness-comet run
harness-comet comet install --init-harness --mode playwright
```

Playwright mode minimal generated tree:

```text
project/
├── tests/
│   └── example.spec.ts
├── docs/
│   └── testing/
│       └── README.md
├── playwright.config.ts
├── harness-comet.config.ts
└── package.json
```

## File Map

Create:

- `packages/playwright/package.json`  
  New helper package for Playwright-mode tests.

- `packages/playwright/src/index.ts`  
  Exports `defineHarnessScenario`, metadata types, and a helper for adding Playwright annotations at runtime.

- `packages/playwright/src/index.test.ts`  
  Unit tests for metadata validation.

- `packages/core/src/project-config.ts`  
  Unified config discovery and loading for `harness-comet.config.ts`.

- `packages/core/src/playwright/config.ts`  
  Playwright-mode config schema helpers and default values.

- `packages/core/src/playwright/discovery.ts`  
  Discovers Playwright spec files and extracts Harness scenario metadata.

- `packages/core/src/playwright/runner.ts`  
  Spawns the Playwright CLI for `harness-comet run` in Playwright mode.

- `packages/core/src/playwright/validate.ts`  
  Validates Playwright-mode config, test files, and metadata.

- `packages/cli/src/commands/run.ts`  
  Splits run command implementation out of `index.ts` and dispatches by project mode.

- `packages/cli/src/commands/validate.ts`  
  Splits validate command implementation out of `index.ts` and dispatches by project mode.

- `packages/cli/src/templates/playwright-mode.ts`  
  Minimal Playwright-mode init templates.

- `test/playwright-mode-init.integration.test.ts`  
  Integration tests for minimal initialization.

- `test/playwright-mode-validate.integration.test.ts`  
  Integration tests for Playwright-mode validation.

- `test/playwright-mode-run.integration.test.ts`  
  Integration tests for Playwright-mode run command.

- `test/comet-playwright-hooks.integration.test.ts`  
  Integration tests for Comet hook behavior in Playwright mode.

Modify:

- `package.json`  
  Add workspace scripts if needed and include `packages/playwright`.

- `pnpm-workspace.yaml`  
  Ensure `packages/*` already covers `packages/playwright`; modify only if needed.

- `tsconfig.json`  
  Include new package references if this repo uses TS project references.

- `packages/schema/src/index.ts`  
  Add project-mode and Playwright-mode config schemas without breaking runtime schemas.

- `packages/core/src/index.ts`  
  Export new config loader, Playwright validation, Playwright discovery, and mode-aware runner helpers.

- `packages/core/src/config.ts` or existing config loader file  
  Replace direct `harness.config.ts` default lookup with `harness-comet.config.ts` discovery.

- `packages/cli/src/commands/init.ts`  
  Add `--mode runtime|playwright`, generate `harness-comet.config.ts`, keep runtime template compatibility.

- `packages/cli/src/index.ts`  
  Wire mode-aware init, validate, run, and keep existing command behavior.

- `packages/comet-adapter/src/assets.ts`  
  Add mode-specific Comet skill patch text for Playwright mode.

- `packages/comet-adapter/src/hooks.ts`  
  Dispatch hook validation by mode.

- `packages/comet-adapter/src/change.ts`  
  Parse Playwright-mode Harness sections.

- `packages/comet-adapter/src/verify.ts` and `packages/comet-adapter/src/archive-check.ts`  
  Validate Playwright-mode verification and archive sections.

- Existing integration tests under `test/`  
  Update config filenames from `harness.config.ts` to `harness-comet.config.ts`.

- Existing examples under `examples/`  
  Rename config files to `harness-comet.config.ts` and add `mode: "runtime"`.

---

## Task 1: Add Unified Project Mode Schemas

**Files:**

- Modify: `packages/schema/src/index.ts`
- Modify: `packages/schema/src/schema.test.ts`

- [ ] **Step 1: Add failing schema tests**

Add tests covering:

```ts
import {
  HarnessCometConfigV1Schema,
  PlaywrightModeConfigV1Schema,
  RuntimeModeConfigV1Schema
} from "./index.js";

it("parses runtime mode config with existing runtime fields", () => {
  const parsed = HarnessCometConfigV1Schema.parse({
    schemaVersion: 1,
    mode: "runtime",
    paths: {
      scenarios: "harness/scenarios",
      fixtures: "harness/fixtures",
      adapters: "harness/adapters",
      oracles: "harness/oracles"
    },
    adapter: {
      default: "memory",
      entries: {
        memory: "@harness-comet/adapter-memory"
      }
    }
  });

  expect(parsed.mode).toBe("runtime");
});

it("parses playwright mode config", () => {
  const parsed = HarnessCometConfigV1Schema.parse({
    schemaVersion: 1,
    mode: "playwright",
    playwright: {
      configFile: "playwright.config.ts",
      testDir: "tests",
      testMatch: ["**/*.spec.ts"]
    },
    impact: {
      defaultMode: "maintain",
      requireOpenImpact: true,
      requireDesignDecision: true,
      requireVerifyEvidence: true
    }
  });

  expect(parsed.mode).toBe("playwright");
  expect(parsed.playwright.testDir).toBe("tests");
});

it("rejects runtime adapter fields inside playwright mode", () => {
  expect(() =>
    HarnessCometConfigV1Schema.parse({
      schemaVersion: 1,
      mode: "playwright",
      adapter: {
        default: "memory",
        entries: {
          memory: "@harness-comet/adapter-memory"
        }
      },
      playwright: {
        configFile: "playwright.config.ts",
        testDir: "tests",
        testMatch: ["**/*.spec.ts"]
      }
    })
  ).toThrow();
});
```

- [ ] **Step 2: Run schema tests and confirm failure**

Run:

```bash
pnpm --filter @harness-comet/schema test
```

Expected: FAIL because new schemas are not exported.

- [ ] **Step 3: Implement schemas**

Add these exports to `packages/schema/src/index.ts`:

```ts
export const HarnessProjectModeSchema = z.enum(["runtime", "playwright"]);

export const ImpactModeSchema = z.enum(["full", "maintain", "off"]);

export const ImpactDecisionSchema = z.enum([
  "reuse",
  "update",
  "extend",
  "create",
  "deprecate",
  "none"
]);

export const PlaywrightModeConfigV1Schema = z.object({
  schemaVersion: z.literal(1).optional(),
  mode: z.literal("playwright"),
  playwright: z.object({
    configFile: z.string().min(1).default("playwright.config.ts"),
    testDir: z.string().min(1).default("tests"),
    testMatch: z.array(z.string().min(1)).default(["**/*.spec.ts"])
  }),
  docs: z
    .object({
      testingDir: z.string().min(1).default("docs/testing")
    })
    .optional(),
  impact: z
    .object({
      defaultMode: ImpactModeSchema.default("maintain"),
      requireOpenImpact: z.boolean().default(true),
      requireDesignDecision: z.boolean().default(true),
      requireVerifyEvidence: z.boolean().default(true)
    })
    .optional()
});

export const RuntimeModeConfigV1Schema = HarnessConfigV1Schema.extend({
  mode: z.literal("runtime").optional()
});

export const HarnessCometConfigV1Schema = z.discriminatedUnion("mode", [
  RuntimeModeConfigV1Schema.extend({ mode: z.literal("runtime") }),
  PlaywrightModeConfigV1Schema
]);

export type HarnessProjectMode = z.infer<typeof HarnessProjectModeSchema>;
export type ImpactMode = z.infer<typeof ImpactModeSchema>;
export type ImpactDecision = z.infer<typeof ImpactDecisionSchema>;
export type RuntimeModeConfigV1 = z.infer<typeof RuntimeModeConfigV1Schema>;
export type PlaywrightModeConfigV1 = z.infer<typeof PlaywrightModeConfigV1Schema>;
export type HarnessCometConfigV1 = z.infer<typeof HarnessCometConfigV1Schema>;
```

If the discriminated union conflicts with existing optional `mode`, implement a `z.union` plus `superRefine` instead. The observable behavior must match the tests above.

- [ ] **Step 4: Run schema tests**

Run:

```bash
pnpm --filter @harness-comet/schema test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/schema/src/index.ts packages/schema/src/schema.test.ts
git commit -m "feat(schema): add harness-comet project modes"
```

---

## Task 2: Add Unified Config Discovery With Legacy Fallback

**Files:**

- Create: `packages/core/src/project-config.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/project-config.test.ts`

- [ ] **Step 1: Add failing config discovery tests**

Create `packages/core/src/project-config.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadHarnessCometConfig } from "./project-config.js";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-comet-config-"));
}

describe("loadHarnessCometConfig", () => {
  it("loads harness-comet.config.ts", async () => {
    const root = await tempProject();
    await fs.writeFile(
      path.join(root, "harness-comet.config.ts"),
      `export default {
        schemaVersion: 1,
        mode: "playwright",
        playwright: { configFile: "playwright.config.ts", testDir: "tests", testMatch: ["**/*.spec.ts"] }
      };`
    );

    const loaded = await loadHarnessCometConfig({ root });
    expect(loaded.configPath.endsWith("harness-comet.config.ts")).toBe(true);
    expect(loaded.config.mode).toBe("playwright");
  });

  it("does not load harness.config.ts by default", async () => {
    const root = await tempProject();
    await fs.writeFile(
      path.join(root, "harness.config.ts"),
      `export default {
        schemaVersion: 1,
        mode: "runtime",
        adapter: { default: "memory", entries: { memory: "@harness-comet/adapter-memory" } }
      };`
    );

    await expect(loadHarnessCometConfig({ root })).rejects.toThrow("Missing harness-comet.config.ts");
  });

  it("can load an explicitly provided config path", async () => {
    const root = await tempProject();
    await fs.writeFile(
      path.join(root, "custom.config.ts"),
      `export default {
        schemaVersion: 1,
        mode: "runtime",
        adapter: { default: "memory", entries: { memory: "@harness-comet/adapter-memory" } }
      };`
    );

    const loaded = await loadHarnessCometConfig({ root, config: "custom.config.ts" });
    expect(loaded.configPath.endsWith("custom.config.ts")).toBe(true);
    expect(loaded.config.mode).toBe("runtime");
  });
});
```

- [ ] **Step 2: Run core tests and confirm failure**

Run:

```bash
pnpm --filter @harness-comet/core test -- project-config
```

Expected: FAIL because `project-config.ts` does not exist.

- [ ] **Step 3: Implement config loader**

Create `packages/core/src/project-config.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  HarnessCometConfigV1Schema,
  type HarnessCometConfigV1
} from "@harness-comet/schema";
import { HarnessError } from "./errors.js";

export interface LoadHarnessCometConfigOptions {
  root?: string;
  config?: string;
}

export interface LoadedHarnessCometConfig {
  root: string;
  configPath: string;
  config: HarnessCometConfigV1;
}

const CONFIG_FILE = "harness-comet.config.ts";

export async function loadHarnessCometConfig(
  options: LoadHarnessCometConfigOptions = {}
): Promise<LoadedHarnessCometConfig> {
  const root = path.resolve(options.root ?? process.cwd());
  const candidates = options.config
    ? [path.resolve(root, options.config)]
    : [path.join(root, CONFIG_FILE)];

  for (const file of candidates) {
    try {
      await fs.access(file);
      const imported = await import(`${pathToFileURL(file).href}?t=${Date.now()}`);
      const raw = imported.default ?? imported.config;
      const config = HarnessCometConfigV1Schema.parse(normalizeMode(raw));
      return { root, configPath: file, config };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw new HarnessError({
        code: "CONFIG_INVALID",
        category: "config",
        message: error instanceof Error ? error.message : String(error),
        file
      });
    }
  }

  throw new HarnessError({
    code: "CONFIG_NOT_FOUND",
    category: "config",
    message: `Missing ${CONFIG_FILE}`
  });
}

function normalizeMode(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const object = raw as Record<string, unknown>;
  if (!object.mode) return { ...object, mode: "runtime" };
  return object;
}
```

Adjust imports to match the current core error file. If `HarnessError` lives in a different file, use the existing import path.

- [ ] **Step 4: Export loader**

Modify `packages/core/src/index.ts`:

```ts
export {
  loadHarnessCometConfig,
  type LoadedHarnessCometConfig,
  type LoadHarnessCometConfigOptions
} from "./project-config.js";
```

- [ ] **Step 5: Run tests**

Run:

```bash
pnpm --filter @harness-comet/core test -- project-config
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/project-config.ts packages/core/src/project-config.test.ts packages/core/src/index.ts
git commit -m "feat(core): load unified harness-comet config"
```

---

## Task 3: Add Playwright Helper Package

**Files:**

- Create: `packages/playwright/package.json`
- Create: `packages/playwright/src/index.ts`
- Create: `packages/playwright/src/index.test.ts`
- Create: `packages/playwright/tsconfig.json`
- Create: `packages/playwright/vitest.config.ts`
- Modify: root package and TS references if required

- [ ] **Step 1: Add failing tests**

Create `packages/playwright/src/index.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { defineHarnessScenario, harnessAnnotation } from "./index.js";

describe("defineHarnessScenario", () => {
  it("returns normalized metadata", () => {
    const scenario = defineHarnessScenario({
      id: "annotation-polygon-create",
      title: "Create polygon annotation",
      component: "annotation",
      capability: "polygon-authoring",
      behavior: "create-polygon-and-save",
      contract: "annotation-polygon-save",
      kind: "journey",
      risk: "high",
      tags: ["annotation"]
    });

    expect(scenario.id).toBe("annotation-polygon-create");
    expect(scenario.risk).toBe("high");
  });

  it("creates a Playwright annotation", () => {
    const scenario = defineHarnessScenario({
      id: "example-smoke",
      title: "Example smoke",
      component: "example",
      capability: "render-page",
      behavior: "show-page",
      contract: "example-page-visible"
    });

    expect(harnessAnnotation(scenario)).toEqual({
      type: "harness-scenario",
      description: "example-smoke"
    });
  });
});
```

- [ ] **Step 2: Run package test and confirm failure**

Run:

```bash
pnpm --filter @harness-comet/playwright test
```

Expected: FAIL because package does not exist.

- [ ] **Step 3: Create package files**

Create `packages/playwright/package.json`:

```json
{
  "name": "@harness-comet/playwright",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "lint": "eslint src --ext .ts"
  },
  "dependencies": {
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "vitest": "^3.0.0"
  },
  "peerDependencies": {
    "@playwright/test": "^1.56.0"
  }
}
```

Create `packages/playwright/src/index.ts`:

```ts
import { z } from "zod";

export const HarnessScenarioKindSchema = z.enum(["smoke", "journey", "regression", "contract"]);
export const HarnessScenarioRiskSchema = z.enum(["low", "medium", "high"]);

export const HarnessScenarioMetadataSchema = z.object({
  id: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  component: z.string().min(1),
  capability: z.string().min(1),
  behavior: z.string().min(1),
  contract: z.string().min(3),
  kind: HarnessScenarioKindSchema.default("journey"),
  risk: HarnessScenarioRiskSchema.default("medium"),
  tags: z.array(z.string().min(1)).default([]),
  linkedIssue: z.string().min(1).optional()
});

export type HarnessScenarioMetadata = z.infer<typeof HarnessScenarioMetadataSchema>;

export function defineHarnessScenario(input: HarnessScenarioMetadata): HarnessScenarioMetadata {
  return HarnessScenarioMetadataSchema.parse(input);
}

export function harnessAnnotation(
  scenario: HarnessScenarioMetadata
): { type: string; description: string } {
  return { type: "harness-scenario", description: scenario.id };
}
```

Create `packages/playwright/tsconfig.json` based on neighboring package configs. Use the same compiler options style as `packages/sdk/tsconfig.json`.

Create `packages/playwright/vitest.config.ts` based on neighboring package configs.

- [ ] **Step 4: Run helper package tests**

Run:

```bash
pnpm --filter @harness-comet/playwright test
pnpm --filter @harness-comet/playwright build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/playwright package.json pnpm-lock.yaml tsconfig.json
git commit -m "feat(playwright): add harness scenario helper"
```

---

## Task 4: Update Init Command For Runtime and Playwright Modes

**Files:**

- Modify: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/index.ts`
- Create: `packages/cli/src/templates/playwright-mode.ts`
- Test: `test/playwright-mode-init.integration.test.ts`
- Modify existing init tests if present

- [ ] **Step 1: Add failing integration tests**

Create `test/playwright-mode-init.integration.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-init-"));
}

describe("init --mode playwright", () => {
  it("creates a minimal Playwright mode project", async () => {
    const root = await tempProject();
    const result = await execa("node", [
      "packages/cli/bin/harness-comet.js",
      "--root",
      root,
      "init",
      "--mode",
      "playwright",
      "--yes"
    ]);

    expect(result.exitCode).toBe(0);
    await expect(fs.stat(path.join(root, "harness-comet.config.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "playwright.config.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "tests", "example.spec.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "docs", "testing", "README.md"))).resolves.toBeTruthy();

    await expect(fs.stat(path.join(root, "tests", "pages"))).rejects.toThrow();
    await expect(fs.stat(path.join(root, "tests", "drivers"))).rejects.toThrow();
  });

  it("adds Playwright dependencies unless skipped", async () => {
    const root = await tempProject();
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "target", private: true }, null, 2));

    const result = await execa("node", [
      "packages/cli/bin/harness-comet.js",
      "--root",
      root,
      "init",
      "--mode",
      "playwright",
      "--yes",
      "--skip-install"
    ]);

    expect(result.exitCode).toBe(0);
    const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
    expect(pkg.devDependencies["@playwright/test"]).toBeDefined();
    expect(pkg.devDependencies["@harness-comet/playwright"]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
pnpm test -- playwright-mode-init
```

Expected: FAIL because `--mode` is not supported.

- [ ] **Step 3: Add Playwright templates**

Create `packages/cli/src/templates/playwright-mode.ts`:

```ts
export function playwrightHarnessCometConfigTemplate(testDir = "tests"): string {
  return `export default {
  schemaVersion: 1,
  mode: "playwright",
  playwright: {
    configFile: "playwright.config.ts",
    testDir: "${testDir}",
    testMatch: ["**/*.spec.ts"]
  },
  docs: {
    testingDir: "docs/testing"
  },
  impact: {
    defaultMode: "maintain",
    requireOpenImpact: true,
    requireDesignDecision: true,
    requireVerifyEvidence: true
  }
};
`;
}

export function playwrightConfigTemplate(testDir = "tests"): string {
  return `import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "${testDir}",
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry"
  }
});
`;
}

export function playwrightExampleSpecTemplate(): string {
  return `import { test, expect } from "@playwright/test";
import { defineHarnessScenario, harnessAnnotation } from "@harness-comet/playwright";

const scenario = defineHarnessScenario({
  id: "example-smoke",
  title: "Example smoke",
  component: "example",
  capability: "render-page",
  behavior: "show-example-page",
  contract: "example-page-visible",
  kind: "smoke",
  risk: "low",
  tags: ["smoke"]
});

test(scenario.title, async ({ page }, testInfo) => {
  testInfo.annotations.push(harnessAnnotation(scenario));

  await page.goto("data:text/html,<title>Harness</title><main>Hello Harness</main>");
  await expect(page.getByText("Hello Harness")).toBeVisible();
});
`;
}

export function testingReadmeTemplate(): string {
  return `# Testing

This project uses Playwright mode for Harness-Comet.

Playwright owns test execution through \`playwright.config.ts\`.
Harness-Comet owns business scenario metadata, Comet impact decisions, verification evidence, and archive checks.

Keep tests focused on business behavior. Add helper files and directories only when the project needs them.
`;
}
```

- [ ] **Step 4: Extend init implementation**

Modify `packages/cli/src/commands/init.ts`:

- Add `mode: "runtime" | "playwright"` to `InitHarnessOptions`.
- Default mode to `"runtime"` to preserve current behavior.
- Runtime mode writes `harness-comet.config.ts`, not `harness.config.ts`.
- Runtime mode still creates current `harness/scenarios`, `harness/fixtures`, `harness/adapters`, `harness/oracles`.
- Playwright mode writes only:
  - `harness-comet.config.ts`
  - `playwright.config.ts`
  - `${testDir}/example.spec.ts`
  - `docs/testing/README.md`
- Playwright mode ensures `package.json` has dev dependencies:
  - `@playwright/test`
  - `@harness-comet/playwright`
- Playwright mode installs Chromium by default after dependencies are installed.
- Playwright mode must reuse existing project-owned Playwright if `@playwright/test` is already present.
- Playwright mode must not create runtime `harness/scenarios` or `harness/fixtures`.

Implementation shape:

```ts
export interface InitHarnessOptions {
  root: string;
  mode: "runtime" | "playwright";
  adapter: string;
  testDir?: string;
  install?: boolean;
  installBrowsers?: boolean;
  overwriteConfig?: boolean;
}
```

Add:

```ts
if (options.mode === "playwright") {
  return initPlaywrightModeProject(options);
}
return initRuntimeModeProject(options);
```

- [ ] **Step 5: Extend CLI flags**

Modify `packages/cli/src/index.ts` init command:

```ts
program
  .command("init")
  .option("--mode <runtime|playwright>", "project mode", "runtime")
  .option("--adapter <memory|playwright|custom>", "runtime adapter template", "memory")
  .option("--test-dir <path>", "Playwright test directory", "tests")
  .option("--skip-install", "write files and package.json entries without running package install")
  .option("--skip-browsers", "skip Playwright browser installation")
  .option("--yes", "accept defaults")
  .option("--force", "create missing files even when some exist")
  .option("--overwrite-config", "overwrite harness-comet.config.ts")
```

Pass `mode` and `testDir` into `initHarnessProject`.

- [ ] **Step 6: Add dependency and browser installation helpers**

Create focused helpers inside `packages/cli/src/commands/init.ts` or split into `packages/cli/src/commands/install-deps.ts` if the file becomes too large.

Required behavior:

- If `package.json` is missing, create a minimal private package:

```json
{
  "private": true,
  "devDependencies": {}
}
```

- Add missing dev dependencies without overwriting existing versions:

```json
{
  "devDependencies": {
    "@playwright/test": "^1.56.0",
    "@harness-comet/playwright": "workspace:*"
  }
}
```

For published packages, replace `workspace:*` with the current package version before publishing. During local workspace tests, `workspace:*` is acceptable.

- Detect package manager from lockfile:

```text
pnpm-lock.yaml      -> pnpm
yarn.lock           -> yarn
package-lock.json   -> npm
bun.lockb           -> bun
default             -> pnpm
```

- If `--skip-install` is not set, run the matching install command:

```text
pnpm install
npm install
yarn install
bun install
```

- If `--skip-browsers` is not set, run:

```text
pnpm exec playwright install chromium
npm exec playwright install chromium
yarn playwright install chromium
bunx playwright install chromium
```

- If browser installation fails, init must still report created files and print an actionable warning. It should not delete generated files.

- [ ] **Step 7: Run init tests**

Run:

```bash
pnpm test -- playwright-mode-init
pnpm test -- init
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/index.ts packages/cli/src/templates/playwright-mode.ts test/playwright-mode-init.integration.test.ts
git commit -m "feat(cli): initialize minimal playwright mode projects"
```

---

## Task 5: Add Playwright Metadata Discovery

**Files:**

- Create: `packages/core/src/playwright/discovery.ts`
- Create: `packages/core/src/playwright/discovery.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add failing discovery tests**

Create `packages/core/src/playwright/discovery.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverPlaywrightHarnessAssets } from "./discovery.js";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-discovery-"));
}

describe("discoverPlaywrightHarnessAssets", () => {
  it("finds spec files and extracts defineHarnessScenario metadata", async () => {
    const root = await tempProject();
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(
      path.join(root, "tests", "example.spec.ts"),
      `import { defineHarnessScenario } from "@harness-comet/playwright";
       const scenario = defineHarnessScenario({
         id: "example-smoke",
         title: "Example smoke",
         component: "example",
         capability: "render-page",
         behavior: "show-example-page",
         contract: "example-page-visible"
       });`
    );

    const assets = await discoverPlaywrightHarnessAssets({
      root,
      testDir: "tests",
      testMatch: ["**/*.spec.ts"]
    });

    expect(assets.tests).toHaveLength(1);
    expect(assets.tests[0].scenarios[0].id).toBe("example-smoke");
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
pnpm --filter @harness-comet/core test -- playwright/discovery
```

Expected: FAIL because discovery is missing.

- [ ] **Step 3: Implement discovery**

Create `packages/core/src/playwright/discovery.ts`.

Implementation requirements:

- Use `fs.readdir` recursively.
- Match files by suffix for first version:
  - `**/*.spec.ts`
  - `**/*.test.ts`
  - Respect configured `testMatch` for common suffix patterns.
- Read each file as UTF-8.
- Extract `defineHarnessScenario({ ... })` object literals with a conservative parser.
- For first version, object values may be string literals or string arrays only.
- If extraction is not possible, return an empty scenario list and let validate produce a warning/error.

Minimal implementation is acceptable:

```ts
export interface DiscoverPlaywrightHarnessAssetsOptions {
  root: string;
  testDir: string;
  testMatch: string[];
}

export interface PlaywrightHarnessTestAsset {
  path: string;
  scenarios: Array<{
    id: string;
    title: string;
    component: string;
    capability: string;
    behavior: string;
    contract: string;
    kind?: string;
    risk?: string;
    tags?: string[];
  }>;
}

export interface PlaywrightHarnessAssets {
  tests: PlaywrightHarnessTestAsset[];
}
```

Add helpers:

```ts
function isSpecFile(file: string, testMatch: string[]): boolean {
  if (testMatch.includes("**/*.spec.ts") && file.endsWith(".spec.ts")) return true;
  if (testMatch.includes("**/*.test.ts") && file.endsWith(".test.ts")) return true;
  return file.endsWith(".spec.ts");
}
```

Use a small extractor for `defineHarnessScenario` object:

```ts
function extractScenarioBlocks(source: string): string[] {
  const blocks: string[] = [];
  const marker = "defineHarnessScenario(";
  let index = source.indexOf(marker);
  while (index >= 0) {
    const start = source.indexOf("{", index);
    if (start < 0) break;
    let depth = 0;
    for (let cursor = start; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) {
        blocks.push(source.slice(start, cursor + 1));
        break;
      }
    }
    index = source.indexOf(marker, index + marker.length);
  }
  return blocks;
}
```

Implement string field extraction:

```ts
function stringField(block: string, field: string): string | undefined {
  const match = block.match(new RegExp(`${field}\\\\s*:\\\\s*["'\`]([^"'\`]+)["'\`]`));
  return match?.[1];
}
```

This intentionally avoids executing user test files.

- [ ] **Step 4: Export discovery**

Modify `packages/core/src/index.ts`:

```ts
export {
  discoverPlaywrightHarnessAssets,
  type PlaywrightHarnessAssets,
  type PlaywrightHarnessTestAsset
} from "./playwright/discovery.js";
```

- [ ] **Step 5: Run discovery tests**

Run:

```bash
pnpm --filter @harness-comet/core test -- playwright/discovery
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/playwright/discovery.ts packages/core/src/playwright/discovery.test.ts packages/core/src/index.ts
git commit -m "feat(core): discover playwright harness metadata"
```

---

## Task 6: Add Playwright Mode Validation

**Files:**

- Create: `packages/core/src/playwright/validate.ts`
- Create: `packages/core/src/playwright/validate.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Add failing validation tests**

Create `packages/core/src/playwright/validate.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validatePlaywrightHarnessProject } from "./validate.js";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-validate-"));
}

describe("validatePlaywrightHarnessProject", () => {
  it("passes with config, test dir, playwright config, and metadata", async () => {
    const root = await tempProject();
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default {};");
    await fs.writeFile(
      path.join(root, "tests", "example.spec.ts"),
      `import { defineHarnessScenario } from "@harness-comet/playwright";
       defineHarnessScenario({
         id: "example-smoke",
         title: "Example smoke",
         component: "example",
         capability: "render-page",
         behavior: "show-page",
         contract: "example-page-visible"
       });`
    );

    const result = await validatePlaywrightHarnessProject({
      root,
      playwright: {
        configFile: "playwright.config.ts",
        testDir: "tests",
        testMatch: ["**/*.spec.ts"]
      }
    });

    expect(result.ok).toBe(true);
    expect(result.assets.tests).toHaveLength(1);
  });

  it("fails when no scenario metadata exists", async () => {
    const root = await tempProject();
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default {};");
    await fs.writeFile(path.join(root, "tests", "example.spec.ts"), `import { test } from "@playwright/test";`);

    const result = await validatePlaywrightHarnessProject({
      root,
      playwright: {
        configFile: "playwright.config.ts",
        testDir: "tests",
        testMatch: ["**/*.spec.ts"]
      }
    });

    expect(result.ok).toBe(false);
    expect(result.errors[0].code).toBe("PLAYWRIGHT_METADATA_MISSING");
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
pnpm --filter @harness-comet/core test -- playwright/validate
```

Expected: FAIL because validator does not exist.

- [ ] **Step 3: Implement validator**

Create `packages/core/src/playwright/validate.ts`:

```ts
import fs from "node:fs/promises";
import path from "node:path";
import type { PlaywrightModeConfigV1 } from "@harness-comet/schema";
import { HarnessError } from "../errors.js";
import {
  discoverPlaywrightHarnessAssets,
  type PlaywrightHarnessAssets
} from "./discovery.js";

export interface ValidatePlaywrightHarnessProjectOptions {
  root: string;
  playwright: PlaywrightModeConfigV1["playwright"];
}

export interface PlaywrightValidationResult {
  ok: boolean;
  assets: PlaywrightHarnessAssets;
  errors: HarnessError[];
  warnings: HarnessError[];
}

export async function validatePlaywrightHarnessProject(
  options: ValidatePlaywrightHarnessProjectOptions
): Promise<PlaywrightValidationResult> {
  const errors: HarnessError[] = [];
  const warnings: HarnessError[] = [];

  await requirePath(path.join(options.root, options.playwright.configFile), "PLAYWRIGHT_CONFIG_MISSING", errors);
  await requirePath(path.join(options.root, options.playwright.testDir), "PLAYWRIGHT_TEST_DIR_MISSING", errors);

  const assets = await discoverPlaywrightHarnessAssets({
    root: options.root,
    testDir: options.playwright.testDir,
    testMatch: options.playwright.testMatch
  });

  const scenarioCount = assets.tests.reduce((count, test) => count + test.scenarios.length, 0);
  if (scenarioCount === 0) {
    errors.push(
      new HarnessError({
        code: "PLAYWRIGHT_METADATA_MISSING",
        category: "schema",
        message: "No defineHarnessScenario metadata found in Playwright tests"
      })
    );
  }

  return { ok: errors.length === 0, assets, errors, warnings };
}

async function requirePath(file: string, code: string, errors: HarnessError[]): Promise<void> {
  try {
    await fs.access(file);
  } catch {
    errors.push(
      new HarnessError({
        code,
        category: "config",
        message: `Required path is missing: ${file}`,
        file
      })
    );
  }
}
```

- [ ] **Step 4: Export validator**

Modify `packages/core/src/index.ts`:

```ts
export {
  validatePlaywrightHarnessProject,
  type PlaywrightValidationResult
} from "./playwright/validate.js";
```

- [ ] **Step 5: Run validation tests**

Run:

```bash
pnpm --filter @harness-comet/core test -- playwright/validate
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/playwright/validate.ts packages/core/src/playwright/validate.test.ts packages/core/src/index.ts
git commit -m "feat(core): validate playwright mode projects"
```

---

## Task 7: Make CLI Validate Dispatch By Mode

**Files:**

- Modify: `packages/cli/src/index.ts`
- Optional Create: `packages/cli/src/commands/validate.ts`
- Test: `test/playwright-mode-validate.integration.test.ts`

- [ ] **Step 1: Add failing CLI validation test**

Create `test/playwright-mode-validate.integration.test.ts`:

```ts
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-cli-validate-"));
}

describe("validate in playwright mode", () => {
  it("validates Playwright-mode projects instead of runtime assets", async () => {
    const root = await tempProject();
    await fs.mkdir(path.join(root, "tests"), { recursive: true });
    await fs.writeFile(
      path.join(root, "harness-comet.config.ts"),
      `export default {
        schemaVersion: 1,
        mode: "playwright",
        playwright: { configFile: "playwright.config.ts", testDir: "tests", testMatch: ["**/*.spec.ts"] }
      };`
    );
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default {};");
    await fs.writeFile(
      path.join(root, "tests", "example.spec.ts"),
      `import { defineHarnessScenario } from "@harness-comet/playwright";
       defineHarnessScenario({
         id: "example-smoke",
         title: "Example smoke",
         component: "example",
         capability: "render-page",
         behavior: "show-page",
         contract: "example-page-visible"
       });`
    );

    const result = await execa("node", [
      "packages/cli/bin/harness-comet.js",
      "--root",
      root,
      "validate"
    ]);

    expect(result.stdout).toContain("Playwright harness assets are valid");
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
pnpm test -- playwright-mode-validate
```

Expected: FAIL because CLI validate still uses runtime loader.

- [ ] **Step 3: Implement mode dispatch**

Modify `validateCommand`:

```ts
const project = await loadHarnessCometConfig({ root: global.root, config: global.config });

if (project.config.mode === "playwright") {
  const result = await validatePlaywrightHarnessProject({
    root: project.root,
    playwright: project.config.playwright
  });
  if (!result.ok) throw result.errors[0];
  output(
    global,
    {
      ok: true,
      mode: "playwright",
      tests: result.assets.tests.length,
      scenarios: result.assets.tests.reduce((count, test) => count + test.scenarios.length, 0)
    },
    "Playwright harness assets are valid"
  );
  return;
}

// Existing runtime validation path remains unchanged.
```

For runtime path, either:

- convert `LoadedHarnessCometConfig` runtime config into current `LoadedHarnessConfig`, or
- keep existing `loadHarnessConfig` and update it internally to use unified discovery.

Do not make Playwright mode call `discoverHarnessAssets`.

- [ ] **Step 4: Run validation CLI tests**

Run:

```bash
pnpm test -- playwright-mode-validate
pnpm test -- validate
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src/index.ts test/playwright-mode-validate.integration.test.ts
git commit -m "feat(cli): validate projects by harness-comet mode"
```

---

## Task 8: Add Playwright Mode Runner

**Files:**

- Create: `packages/core/src/playwright/runner.ts`
- Create: `packages/core/src/playwright/runner.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/cli/src/index.ts`
- Test: `test/playwright-mode-run.integration.test.ts`

- [ ] **Step 1: Add runner unit test**

Create `packages/core/src/playwright/runner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPlaywrightCommand } from "./runner.js";

describe("buildPlaywrightCommand", () => {
  it("builds default playwright test command", () => {
    expect(
      buildPlaywrightCommand({
        configFile: "playwright.config.ts",
        args: []
      })
    ).toEqual(["exec", "playwright", "test", "--config", "playwright.config.ts"]);
  });

  it("passes through extra args", () => {
    expect(
      buildPlaywrightCommand({
        configFile: "playwright.config.ts",
        args: ["tests/example.spec.ts", "--headed"]
      })
    ).toEqual([
      "exec",
      "playwright",
      "test",
      "--config",
      "playwright.config.ts",
      "tests/example.spec.ts",
      "--headed"
    ]);
  });
});
```

- [ ] **Step 2: Run unit test and confirm failure**

Run:

```bash
pnpm --filter @harness-comet/core test -- playwright/runner
```

Expected: FAIL because runner does not exist.

- [ ] **Step 3: Implement runner helper**

Create `packages/core/src/playwright/runner.ts`:

```ts
import { spawn } from "node:child_process";

export interface BuildPlaywrightCommandOptions {
  configFile: string;
  args: string[];
}

export function buildPlaywrightCommand(options: BuildPlaywrightCommandOptions): string[] {
  return ["exec", "playwright", "test", "--config", options.configFile, ...options.args];
}

export interface RunPlaywrightHarnessOptions {
  root: string;
  configFile: string;
  args: string[];
}

export async function runPlaywrightHarness(options: RunPlaywrightHarnessOptions): Promise<number> {
  const args = buildPlaywrightCommand({ configFile: options.configFile, args: options.args });
  return new Promise((resolve) => {
    const child = spawn("pnpm", args, {
      cwd: options.root,
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("exit", (code) => resolve(code ?? 10));
    child.on("error", () => resolve(10));
  });
}
```

- [ ] **Step 4: Export runner**

Modify `packages/core/src/index.ts`:

```ts
export { buildPlaywrightCommand, runPlaywrightHarness } from "./playwright/runner.js";
```

- [ ] **Step 5: Dispatch run command by mode**

Modify CLI `runCommand`:

```ts
const project = await loadHarnessCometConfig({ root: global.root, config: global.config });

if (project.config.mode === "playwright") {
  const passThroughArgs: string[] = [];
  if (options.headed) passThroughArgs.push("--headed");
  const code = await runPlaywrightHarness({
    root: project.root,
    configFile: project.config.playwright.configFile,
    args: passThroughArgs
  });
  process.exitCode = code;
  return;
}

// Existing runtime path remains unchanged.
```

Do not support `--scenario` in Playwright mode in the first version. If user passes runtime-only flags in Playwright mode, throw:

```text
--scenario is only supported in runtime mode; pass Playwright file filters after -- in playwright mode
```

- [ ] **Step 6: Add integration test**

Create `test/playwright-mode-run.integration.test.ts` with a project initialized in Playwright mode. Use a `data:` URL test so no dev server is required. Run:

```bash
node packages/cli/bin/harness-comet.js --root <root> run
```

Expected: exit code `0`.

- [ ] **Step 7: Run tests**

Run:

```bash
pnpm --filter @harness-comet/core test -- playwright/runner
pnpm test -- playwright-mode-run
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/playwright/runner.ts packages/core/src/playwright/runner.test.ts packages/core/src/index.ts packages/cli/src/index.ts test/playwright-mode-run.integration.test.ts
git commit -m "feat(cli): run playwright mode through playwright"
```

---

## Task 9: Update Comet Skill Patch Text For Playwright Mode

**Files:**

- Modify: `packages/comet-adapter/src/assets.ts`
- Modify: `packages/comet-adapter/src/types.ts` if needed
- Test: `test/comet-install.integration.test.ts`
- Test: `test/comet-diff.integration.test.ts`

- [ ] **Step 1: Add failing tests for mode-specific patch content**

Add test case:

```ts
it("patches Playwright mode Comet skills with Playwright-specific protocol", async () => {
  // Arrange a temp project with harness-comet.config.ts mode playwright
  // Run comet install/diff patch generation
  // Assert patched skill text contains:
  // "Harness Playwright Impact"
  // "targetTests"
  // "defineHarnessScenario"
  // Assert it does not contain runtime-only words:
  // "harness/scenarios"
  // "fixtureRefs"
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
pnpm test -- comet-install
```

Expected: FAIL because current patch text is runtime-oriented.

- [ ] **Step 3: Implement Playwright-specific phase text**

In `packages/comet-adapter/src/assets.ts`, add a mode-aware patch builder:

```ts
export type HarnessCometProjectMode = "runtime" | "playwright";

export function phasePatchForMode(phase: CometPhase, mode: HarnessCometProjectMode, language: "en" | "zh"): string {
  if (mode === "playwright") return playwrightPhasePatch(phase, language);
  return runtimePhasePatch(phase, language);
}
```

Playwright open patch must require:

```md
## Harness Playwright Impact

mode: full | maintain | off
reason:
affectedCapabilities:
existingPlaywrightAssets:
preliminaryDecision: reuse | update | extend | create | deprecate | none
```

Playwright design patch must require:

```md
## Harness Playwright Design

mode: full | maintain | off
decision: reuse | update | extend | create | deprecate | none
decisionReason:
targetTests:
  - path:
    scenarioId:
    action:
    reason:
relatedFiles:
  - path:
    reason:
verification:
  commands:
```

Playwright build patch must require:

```md
## Harness Playwright Build

Follow the Harness Playwright Design.
Use official Playwright tests.
Do not create directory categories unless this project needs them.
Every key business test must use defineHarnessScenario metadata.
```

Playwright verify patch must require:

```md
## Harness Playwright Verification

commandsRun:
results:
evidence:
decisionCheck:
```

Playwright archive patch must require:

```md
## Harness Playwright Archive

mode:
finalDecision:
assetsChanged:
verification:
longTermNotes:
```

- [ ] **Step 4: Respect language selection**

Existing language persistence must continue to work. Add Chinese patch text for Playwright mode when language is `zh`. The Chinese text must preserve section headings exactly if hooks parse exact headings:

```md
## Harness Playwright Impact
## Harness Playwright Design
## Harness Playwright Build
## Harness Playwright Verification
## Harness Playwright Archive
```

Content under headings can be Chinese.

- [ ] **Step 5: Run Comet patch tests**

Run:

```bash
pnpm test -- comet-install
pnpm test -- comet-diff
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/comet-adapter/src/assets.ts packages/comet-adapter/src/types.ts test/comet-install.integration.test.ts test/comet-diff.integration.test.ts
git commit -m "feat(comet): patch playwright mode phase guidance"
```

---

## Task 10: Add Playwright Mode Comet Hook Validation

**Files:**

- Modify: `packages/comet-adapter/src/hooks.ts`
- Modify: `packages/comet-adapter/src/change.ts`
- Modify: `packages/comet-adapter/src/verify.ts`
- Modify: `packages/comet-adapter/src/archive-check.ts`
- Test: `test/comet-playwright-hooks.integration.test.ts`

- [ ] **Step 1: Add failing hook tests**

Create `test/comet-playwright-hooks.integration.test.ts`.

Test cases:

1. Open passes with `## Harness Playwright Impact`.
2. Open fails without `mode`.
3. Design passes with `targetTests` and `verification.commands`.
4. Design fails when `mode=off` and `decision=create`.
5. Build fails when a changed Playwright spec lacks `defineHarnessScenario`.
6. Verify passes when command output/evidence covers target test.
7. Archive fails when verification status is failed but archive claims completed.

Use minimal markdown files under temp `openspec/changes/<change>/`.

- [ ] **Step 2: Run hook tests and confirm failure**

Run:

```bash
pnpm test -- comet-playwright-hooks
```

Expected: FAIL because hooks do not support Playwright mode sections.

- [ ] **Step 3: Add mode detection to hooks**

In `packages/comet-adapter/src/hooks.ts`, load project config via core config loader or a local lightweight reader.

Dispatch:

```ts
if (projectMode === "playwright") {
  return validatePlaywrightPhaseHook(options);
}
return validateRuntimePhaseHook(options);
```

Do not call runtime scenario discovery in Playwright mode.

- [ ] **Step 4: Parse Playwright sections**

In `packages/comet-adapter/src/change.ts`, add:

```ts
export interface HarnessPlaywrightImpactSection {
  mode: "full" | "maintain" | "off";
  reason: string;
  preliminaryDecision: "reuse" | "update" | "extend" | "create" | "deprecate" | "none";
}

export interface HarnessPlaywrightDesignSection {
  mode: "full" | "maintain" | "off";
  decision: "reuse" | "update" | "extend" | "create" | "deprecate" | "none";
  decisionReason: string;
  targetTests: Array<{ path: string; scenarioId?: string; action: string; reason: string }>;
  relatedFiles: Array<{ path: string; reason: string }>;
  commands: string[];
}
```

Implement parsers for:

- `## Harness Playwright Impact`
- `## Harness Playwright Design`
- `## Harness Playwright Verification`
- `## Harness Playwright Archive`

Keep parsing simple and markdown-oriented. Do not require YAML fenced blocks in first version.

- [ ] **Step 5: Validate mode matrix**

Rules:

```text
full:
  allowed decisions: reuse, update, extend, create, deprecate, none

maintain:
  allowed decisions: reuse, update, extend, deprecate, none
  create is allowed only when decisionReason contains "new independent business behavior" or "historical regression"

off:
  allowed decisions: none
  targetTests must be empty
  Build must not modify Playwright test assets
```

- [ ] **Step 6: Validate Playwright metadata in build**

For changed files ending `.spec.ts`, require:

```text
defineHarnessScenario({
```

This is intentionally lightweight for first version.

- [ ] **Step 7: Validate verify**

Require:

- `## Harness Playwright Verification`
- `commandsRun`
- `results`
- `evidence`
- `decisionCheck`
- If Design target tests exist, at least one verify command must mention each target test path or an explicitly broader command such as `pnpm exec playwright test`.

- [ ] **Step 8: Validate archive**

Require:

- `## Harness Playwright Archive`
- `finalDecision`
- `assetsChanged`
- `verification`
- `longTermNotes`
- If verification status is failed, archive must not report completed success.

- [ ] **Step 9: Run hook tests**

Run:

```bash
pnpm test -- comet-playwright-hooks
pnpm test -- comet-hooks
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/comet-adapter/src/hooks.ts packages/comet-adapter/src/change.ts packages/comet-adapter/src/verify.ts packages/comet-adapter/src/archive-check.ts test/comet-playwright-hooks.integration.test.ts
git commit -m "feat(comet): validate playwright mode phase protocol"
```

---

## Task 11: Update Comet Install To Support `--mode playwright`

**Files:**

- Modify: `packages/cli/src/commands/comet.ts`
- Modify: `packages/comet-adapter/src/install.ts`
- Test: `test/comet-install.integration.test.ts`

- [ ] **Step 1: Add failing install test**

Add test:

```ts
it("runs comet install with init harness in playwright mode", async () => {
  // temp project with package.json
  // run:
  // node packages/cli/bin/harness-comet.js --root <root> comet install --platform codex --yes --init-harness --mode playwright
  // assert harness-comet.config.ts exists
  // assert playwright.config.ts exists
  // assert tests/example.spec.ts exists
  // assert patched codex skill contains Harness Playwright Impact
});
```

- [ ] **Step 2: Run test and confirm failure**

Run:

```bash
pnpm test -- comet-install
```

Expected: FAIL because `comet install --mode playwright` is not wired.

- [ ] **Step 3: Add CLI options**

In `packages/cli/src/commands/comet.ts`, add options:

```ts
.option("--init-harness", "initialize harness after Comet install")
.option("--mode <runtime|playwright>", "harness mode for --init-harness", "runtime")
.option("--adapter <memory|playwright|custom>", "runtime adapter for --init-harness", "memory")
.option("--test-dir <path>", "Playwright test directory for mode=playwright", "tests")
.option("--skip-install", "write Harness files and package.json entries without running package install")
.option("--skip-browsers", "skip Playwright browser installation")
```

In Playwright mode, `--init-harness` must use the same dependency installation behavior as `harness-comet init --mode playwright`: add missing `@playwright/test` and `@harness-comet/playwright` dev dependencies, run the target project's package install unless `--skip-install` is set, and install Chromium unless `--skip-browsers` is set. Existing project-owned Playwright dependencies must be preserved.

- [ ] **Step 4: Install flow**

Order:

1. Run real Comet init/install command.
2. Detect selected platform and language.
3. If `--init-harness`, run `initHarnessProject` with selected mode.
4. Patch Comet skills using mode-specific patch text.
5. Print summary with created files.

Do not create fake empty Comet skills. Comet owns Comet file generation.

- [ ] **Step 5: Run install tests**

Run:

```bash
pnpm test -- comet-install
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/comet.ts packages/comet-adapter/src/install.ts test/comet-install.integration.test.ts
git commit -m "feat(comet): initialize playwright mode during install"
```

---

## Task 12: Migrate Examples To `harness-comet.config.ts`

**Files:**

- Rename: `examples/memory-demo/harness.config.ts` -> `examples/memory-demo/harness-comet.config.ts`
- Rename: `examples/playwright-demo/harness.config.ts` -> `examples/playwright-demo/harness-comet.config.ts`
- Modify: docs and tests referencing examples

- [ ] **Step 1: Add failing example config test**

Add or update existing integration test:

```ts
it("validates memory demo through harness-comet.config.ts", async () => {
  const result = await execa("node", [
    "packages/cli/bin/harness-comet.js",
    "--root",
    "examples/memory-demo",
    "validate"
  ]);
  expect(result.exitCode).toBe(0);
});
```

- [ ] **Step 2: Rename files**

Use `git mv`:

```bash
git mv examples/memory-demo/harness.config.ts examples/memory-demo/harness-comet.config.ts
git mv examples/playwright-demo/harness.config.ts examples/playwright-demo/harness-comet.config.ts
```

- [ ] **Step 3: Add mode field**

Each runtime example config must include:

```ts
mode: "runtime",
```

Keep existing runtime fields unchanged.

- [ ] **Step 4: Run example tests**

Run:

```bash
pnpm harness-comet --root examples/memory-demo validate
pnpm harness-comet --root examples/memory-demo run --scenario example-smoke
pnpm harness-comet --root examples/playwright-demo validate
```

Expected: PASS. Playwright run may require installed browsers; if browser is unavailable, run validate only and record the limitation.

- [ ] **Step 5: Commit**

```bash
git add examples test
git commit -m "chore(examples): use harness-comet config"
```

---

## Task 13: Update Docs

**Files:**

- Create or Modify: `docs/testing/playwright-mode.md`
- Modify: `PART_A_ACCEPTANCE.md` only if it references config filename
- Modify: root README if present

- [ ] **Step 1: Write Playwright mode docs**

Create `docs/testing/playwright-mode.md`:

```md
# Playwright Mode

Playwright mode is for Web projects that want to use official Playwright tests as the executable source of truth.

Harness-Comet does not replace Playwright. Playwright owns execution through `playwright.config.ts`.
Harness-Comet owns:

- business scenario metadata
- Comet impact decisions
- verification evidence
- archive records

## Initialize

```bash
harness-comet init --mode playwright
```

## Configuration

```ts
export default {
  schemaVersion: 1,
  mode: "playwright",
  playwright: {
    configFile: "playwright.config.ts",
    testDir: "tests",
    testMatch: ["**/*.spec.ts"]
  },
  impact: {
    defaultMode: "maintain",
    requireOpenImpact: true,
    requireDesignDecision: true,
    requireVerifyEvidence: true
  }
};
```

## Scenario Metadata

```ts
import { test, expect } from "@playwright/test";
import { defineHarnessScenario, harnessAnnotation } from "@harness-comet/playwright";

const scenario = defineHarnessScenario({
  id: "example-smoke",
  title: "Example smoke",
  component: "example",
  capability: "render-page",
  behavior: "show-example-page",
  contract: "example-page-visible",
  kind: "smoke",
  risk: "low"
});

test(scenario.title, async ({ page }, testInfo) => {
  testInfo.annotations.push(harnessAnnotation(scenario));
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});
```

## Directory Structure

Harness-Comet does not require a fixed Playwright folder structure.
Use the structure that fits the project.

Small projects can keep tests flat:

```text
tests/
  example.spec.ts
```

Larger projects may add their own helper directories when useful.
Those directories are project conventions, not Harness-Comet protocol.
```

- [ ] **Step 2: Update config filename references**

Search:

```bash
grep -R "harness.config.ts" -n README.md docs packages test examples || true
```

Update references to `harness-comet.config.ts`.

- [ ] **Step 3: Commit**

```bash
git add docs README.md PART_A_ACCEPTANCE.md packages test examples
git commit -m "docs: document playwright mode"
```

---

## Task 14: Full Verification

**Files:**

- No implementation files unless verification reveals bugs.

- [ ] **Step 1: Run build**

Run:

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 2: Run tests**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Run runtime smoke**

Run:

```bash
pnpm harness-comet --root examples/memory-demo validate
pnpm harness-comet --root examples/memory-demo run --scenario example-smoke
```

Expected: PASS.

- [ ] **Step 5: Run Playwright mode smoke**

Create a temp project:

```bash
tmpdir="$(mktemp -d)"
pnpm harness-comet --root "$tmpdir" init --mode playwright --yes
pnpm harness-comet --root "$tmpdir" validate
pnpm harness-comet --root "$tmpdir" run
```

Expected:

- init creates minimal files
- validate passes
- run passes if Playwright and browsers are installed

If browsers are missing, run:

```bash
pnpm exec playwright install chromium
```

Then rerun:

```bash
pnpm harness-comet --root "$tmpdir" run
```

- [ ] **Step 6: Run Comet mode hook smoke**

Use a temp project with:

- `harness-comet.config.ts` mode `playwright`
- fake `openspec/changes/example/design.md`
- valid `## Harness Playwright Design`

Run:

```bash
pnpm harness-comet --root "$tmpdir" comet hook design --change example
```

Expected: PASS.

- [ ] **Step 7: Final commit**

If verification fixes were needed:

```bash
git add .
git commit -m "test: verify playwright mode integration"
```

---

## Acceptance Criteria

- `harness-comet init --mode runtime --adapter memory` still produces a working runtime project.
- `harness-comet init --mode runtime --adapter playwright` still produces a working runtime project.
- `harness-comet init --mode playwright` produces only minimal Playwright-mode files.
- New projects use `harness-comet.config.ts`.
- `harness.config.ts` is not loaded by default.
- `--config <path>` can still load an explicitly specified custom config file.
- Playwright-mode init and Comet install add missing `@playwright/test` and `@harness-comet/playwright` dev dependencies automatically.
- Playwright-mode init and Comet install install Chromium automatically unless skipped.
- If the target project already has `@playwright/test`, the existing project-owned version is preserved.
- Runtime mode does not read Playwright-mode test metadata.
- Playwright mode does not read YAML Scenario / Fixture / Adapter / Inspector / Oracle assets.
- `harness-comet validate` dispatches by mode.
- `harness-comet run` dispatches by mode.
- Playwright mode uses official Playwright runner behavior.
- Playwright mode does not hard-code directories such as `pages`, `drivers`, `api`, `data`, `journeys`, or `regression`.
- Playwright tests can declare business scenario metadata with `defineHarnessScenario`.
- Comet open/design/build/verify/archive hooks validate Playwright-mode sections.
- Comet runtime-mode hooks continue to pass existing tests.
- `pnpm build`, `pnpm test`, and `pnpm lint` pass.

## Self-Review Notes

- This plan preserves existing runtime behavior after migration to `harness-comet.config.ts` with explicit `mode: "runtime"`.
- This plan avoids hard-coded Playwright business directory categories.
- This plan keeps Playwright execution configuration in `playwright.config.ts`.
- This plan keeps Harness-Comet governance in `harness-comet.config.ts`.
- This plan intentionally does not support legacy `harness.config.ts` fallback.
- This plan intentionally starts metadata extraction with conservative source parsing and does not execute user tests during validation.
