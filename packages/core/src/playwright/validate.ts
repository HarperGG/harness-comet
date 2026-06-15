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

  await requirePath(
    path.join(options.root, options.playwright.configFile),
    "PLAYWRIGHT_CONFIG_MISSING",
    errors
  );
  await requirePath(
    path.join(options.root, options.playwright.testDir),
    "PLAYWRIGHT_TEST_DIR_MISSING",
    errors
  );

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
