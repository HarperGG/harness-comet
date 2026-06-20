import fs from "node:fs/promises";
import path from "node:path";
import { HarnessError } from "@hapergg/harness-comet-core";
import {
  playwrightAcceptanceCriteriaTemplate,
  playwrightAttachmentsTemplate,
  playwrightAuthoringGuideTemplate,
  playwrightConfigTemplate,
  playwrightExampleSpecTemplate,
  playwrightFixturesTemplate,
  playwrightHarnessCometConfigTemplate,
  playwrightIncidentGuideTemplate,
  playwrightIncidentReadmeTemplate,
  playwrightMockApiTemplate,
  testingReadmeTemplate
} from "../templates/playwright-mode.js";
import {
  HARNESS_COMET_ADAPTER_MEMORY_PACKAGE,
  HARNESS_COMET_ADAPTER_PLAYWRIGHT_PACKAGE,
  HARNESS_COMET_PLAYWRIGHT_DEPENDENCY,
  HARNESS_COMET_PLAYWRIGHT_PACKAGE
} from "../package-info.js";

export interface InitHarnessOptions {
  root: string;
  mode: "runtime" | "playwright";
  adapter: string;
  testDir?: string;
  install?: boolean;
  installBrowsers?: boolean;
  overwriteConfig?: boolean;
}

export interface InitHarnessResult {
  ok: true;
  created: string[];
  skipped: string[];
  installedDependencies?: boolean;
  installedBrowsers?: boolean;
}

export async function initHarnessProject(options: InitHarnessOptions): Promise<InitHarnessResult> {
  if (options.mode === "playwright") {
    return initPlaywrightModeProject(options);
  }
  return initRuntimeModeProject(options);
}

async function initRuntimeModeProject(options: InitHarnessOptions): Promise<InitHarnessResult> {
  const root = path.resolve(options.root);
  const created: string[] = [];
  const skipped: string[] = [];

  await fs.mkdir(path.join(root, "harness", "scenarios"), { recursive: true });
  await fs.mkdir(path.join(root, "harness", "fixtures", "example-empty"), { recursive: true });
  await fs.mkdir(path.join(root, "harness", "adapters"), { recursive: true });
  await fs.mkdir(path.join(root, "harness", "oracles"), { recursive: true });

  await writeFileSafe(
    path.join(root, "harness-comet.config.ts"),
    runtimeConfigTemplate(options.adapter),
    Boolean(options.overwriteConfig),
    "harness-comet.config.ts",
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, "harness", "fixtures", "example-empty", "fixture.yaml"),
    "schemaVersion: 1\nid: example-empty\ninline: {}\nsource: synthetic\ncontainsSensitiveData: false\nbusiness:\n  purpose: example-empty-state\n  scope: shared\n  consumers:\n    - example-smoke\n",
    false,
    "harness/fixtures/example-empty/fixture.yaml",
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, "harness", "scenarios", "example-smoke.scenario.yaml"),
    scenarioTemplate(options.adapter),
    false,
    "harness/scenarios/example-smoke.scenario.yaml",
    created,
    skipped
  );

  return { ok: true, created, skipped };
}

async function initPlaywrightModeProject(options: InitHarnessOptions): Promise<InitHarnessResult> {
  const root = path.resolve(options.root);
  const created: string[] = [];
  const skipped: string[] = [];
  const testDir = options.testDir ?? "tests";

  await fs.mkdir(path.join(root, testDir, "journeys"), { recursive: true });
  await fs.mkdir(path.join(root, testDir, "incidents"), { recursive: true });
  await fs.mkdir(path.join(root, testDir, "data"), { recursive: true });
  await fs.mkdir(path.join(root, testDir, "support"), { recursive: true });
  await fs.mkdir(path.join(root, "docs", "testing"), { recursive: true });

  await ensureGitignoreEntries(
    path.join(root, ".gitignore"),
    ["test-results", "playwright-report"],
    created,
    skipped
  );

  await writeFileSafe(
    path.join(root, "harness-comet.config.ts"),
    playwrightHarnessCometConfigTemplate(testDir),
    Boolean(options.overwriteConfig),
    "harness-comet.config.ts",
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, "playwright.config.ts"),
    playwrightConfigTemplate(testDir),
    false,
    "playwright.config.ts",
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, testDir, "journeys", "example-save-flow.spec.ts"),
    playwrightExampleSpecTemplate(),
    false,
    `${normalizePath(testDir)}/journeys/example-save-flow.spec.ts`,
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, testDir, "incidents", "README.md"),
    playwrightIncidentReadmeTemplate(),
    false,
    `${normalizePath(testDir)}/incidents/README.md`,
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, testDir, "data", "example-input.json"),
    `${JSON.stringify({ id: "annotation-1", label: "Lot A", comment: "Saved by harness" }, null, 2)}\n`,
    false,
    `${normalizePath(testDir)}/data/example-input.json`,
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, testDir, "data", "example-expected-payload.json"),
    `${JSON.stringify({ id: "annotation-1", label: "Lot A", comment: "Saved by harness" }, null, 2)}\n`,
    false,
    `${normalizePath(testDir)}/data/example-expected-payload.json`,
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, testDir, "support", "mock-api.ts"),
    playwrightMockApiTemplate(),
    false,
    `${normalizePath(testDir)}/support/mock-api.ts`,
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, testDir, "support", "attachments.ts"),
    playwrightAttachmentsTemplate(),
    false,
    `${normalizePath(testDir)}/support/attachments.ts`,
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, testDir, "fixtures.ts"),
    playwrightFixturesTemplate(),
    false,
    `${normalizePath(testDir)}/fixtures.ts`,
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, "docs", "testing", "README.md"),
    testingReadmeTemplate(),
    false,
    "docs/testing/README.md",
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, "docs", "testing", "authoring-guide.md"),
    playwrightAuthoringGuideTemplate(),
    false,
    "docs/testing/authoring-guide.md",
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, "docs", "testing", "incident-guide.md"),
    playwrightIncidentGuideTemplate(),
    false,
    "docs/testing/incident-guide.md",
    created,
    skipped
  );
  await writeFileSafe(
    path.join(root, "docs", "testing", "acceptance-criteria.md"),
    playwrightAcceptanceCriteriaTemplate(),
    false,
    "docs/testing/acceptance-criteria.md",
    created,
    skipped
  );

  await ensurePlaywrightPackageJson(root);

  const install = options.install ?? true;
  const installBrowsers = options.installBrowsers ?? true;
  const installedDependencies = install ? await installProjectDependencies(root) : false;
  const installedBrowsers =
    install && installBrowsers ? await installPlaywrightBrowsers(root) : false;

  return { ok: true, created, skipped, installedDependencies, installedBrowsers };
}

function runtimeConfigTemplate(adapter: string): string {
  const defaultAdapter = adapter === "playwright" ? "playwright" : "memory";
  const entry =
    defaultAdapter === "playwright"
      ? HARNESS_COMET_ADAPTER_PLAYWRIGHT_PACKAGE
      : HARNESS_COMET_ADAPTER_MEMORY_PACKAGE;
  return `export default {
  schemaVersion: 1,
  mode: "runtime",
  paths: {
    scenarios: "harness/scenarios",
    fixtures: "harness/fixtures",
    adapters: "harness/adapters",
    oracles: "harness/oracles"
  },
  adapter: {
    default: "${defaultAdapter}",
    entries: {
      ${defaultAdapter}: "${entry}"
    }
  },
  runtime: {
    scenarioTimeoutMs: 60000,
    stepTimeoutMs: 15000,
    assertionTimeoutMs: 10000,
    workers: 1,
    failFast: false
  }
};
`;
}

export function scenarioTemplate(adapter: string): string {
  if (adapter === "playwright") {
    return `schemaVersion: 1
id: example-smoke
title: Example smoke
adapter: playwright
tags: [smoke]
business:
  component: example-page
  capability: render-static-message
  behavior: show-hello-harness
  contract: example-page-static-message
  status: active
fixtureRefs: [example-empty]
steps:
  - action: page.goto
    input:
      url: "data:text/html,<title>Harness</title><main data-testid='message'>Hello Harness</main>"
assertions:
  - inspect: page.text
    input:
      selector: "[data-testid=message]"
    oracle: value.contains
    expected: "Hello Harness"
`;
  }
  return `schemaVersion: 1
id: example-smoke
title: Example smoke
adapter: memory
tags: [smoke]
business:
  component: example-memory
  capability: store-message
  behavior: write-and-read-message
  contract: example-memory-message-roundtrip
  status: active
fixtureRefs: [example-empty]
steps:
  - action: memory.set
    input:
      key: message
      value: Hello Harness
assertions:
  - inspect: memory.get
    input:
      key: message
    oracle: value.equals
    expected: Hello Harness
`;
}

async function ensurePlaywrightPackageJson(root: string): Promise<void> {
  const packagePath = path.join(root, "package.json");
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(await fs.readFile(packagePath, "utf8")) as Record<string, unknown>;
  } catch {
    pkg = { private: true };
  }

  const devDependencies = ((pkg.devDependencies ?? {}) as Record<string, string>) || {};
  if (!devDependencies["@playwright/test"]) {
    devDependencies["@playwright/test"] = "^1.60.0";
  }
  if (!devDependencies[HARNESS_COMET_PLAYWRIGHT_PACKAGE]) {
    devDependencies[HARNESS_COMET_PLAYWRIGHT_PACKAGE] = HARNESS_COMET_PLAYWRIGHT_DEPENDENCY;
  }

  pkg.private ??= true;
  pkg.devDependencies = sortObject(devDependencies);
  delete pkg.peerDependencies;
  await fs.writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

async function installProjectDependencies(root: string): Promise<boolean> {
  const manager = await detectPackageManager(root);
  const { execa } = await import("execa");
  const command = manager === "yarn" ? "yarn" : manager === "npm" ? "npm" : "pnpm";
  const args = ["install"];
  try {
    await execa(command, args, { cwd: root, stdio: "inherit" });
    return true;
  } catch (error) {
    throw new HarnessError({
      code: "PLAYWRIGHT_DEPENDENCY_INSTALL_FAILED",
      category: "environment",
      message: "Initialized harness assets, but dependency installation failed",
      hint: `Run: ${formatCommand(command, args)}`,
      context: {
        root,
        command: formatCommand(command, args),
        cause: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

async function installPlaywrightBrowsers(root: string): Promise<boolean> {
  const manager = await detectPackageManager(root);
  const { execa } = await import("execa");
  const command = manager === "yarn" ? "yarn" : manager === "npm" ? "npm" : "pnpm";
  const args =
    manager === "yarn"
      ? ["playwright", "install", "chromium"]
      : ["exec", "playwright", "install", "chromium"];
  try {
    await execa(command, args, { cwd: root, stdio: "inherit" });
    return true;
  } catch (error) {
    throw new HarnessError({
      code: "PLAYWRIGHT_BROWSER_INSTALL_FAILED",
      category: "environment",
      message: "Initialized harness assets and dependencies, but Chromium installation failed",
      hint: "Run: pnpm exec playwright install chromium",
      context: {
        root,
        command: formatCommand(command, args),
        cause: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

async function detectPackageManager(root: string): Promise<"pnpm" | "npm" | "yarn"> {
  const resolve = await loadDetectPackageManager();
  return resolve(root);
}

async function loadDetectPackageManager(): Promise<
  (root: string) => Promise<"pnpm" | "npm" | "yarn">
> {
  try {
    const core = await import("@hapergg/harness-comet-core");
    if ("detectPackageManager" in core) {
      return core.detectPackageManager;
    }
  } catch {
    // Fall back to local source during workspace development.
  }

  const sourceModuleUrl = new URL("../../../core/src/package-manager.ts", import.meta.url);
  const source = await import(sourceModuleUrl.href);
  return source.detectPackageManager;
}

function sortObject(input: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => left.localeCompare(right))
  );
}

function formatCommand(command: string, args: string[]): string {
  return [command, ...args].join(" ");
}

function normalizePath(value: string): string {
  return value.split(path.sep).join("/");
}

async function ensureGitignoreEntries(
  file: string,
  entries: string[],
  created: string[],
  skipped: string[]
): Promise<void> {
  let current = "";
  try {
    current = await fs.readFile(file, "utf8");
  } catch {
    current = "";
  }

  const lines = current.split(/\r?\n/);
  const existing = new Set(lines.map((line) => line.trim()).filter(Boolean));
  const missing = entries.filter((entry) => !existing.has(entry));
  if (missing.length === 0) {
    skipped.push(".gitignore");
    return;
  }

  const next =
    current.length === 0
      ? `${missing.join("\n")}\n`
      : `${current}${current.endsWith("\n") ? "" : "\n"}${missing.join("\n")}\n`;
  await fs.writeFile(file, next, "utf8");
  created.push(".gitignore");
}

async function writeFileSafe(
  file: string,
  content: string,
  overwrite: boolean,
  relativePath: string,
  created: string[],
  skipped: string[]
): Promise<void> {
  try {
    if (!overwrite) await fs.access(file);
  } catch {
    await fs.writeFile(file, content, "utf8");
    created.push(relativePath);
    return;
  }
  if (overwrite) {
    await fs.writeFile(file, content, "utf8");
    created.push(relativePath);
    return;
  }
  skipped.push(relativePath);
}
