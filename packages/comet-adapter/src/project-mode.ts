import fs from "node:fs/promises";
import path from "node:path";
import { loadHarnessCometConfig } from "@hapergg/harness-comet-core";
import type { HarnessCometProjectMode } from "./types.js";

export async function resolveHarnessCometProjectMode(
  projectRoot: string,
  override?: HarnessCometProjectMode
): Promise<HarnessCometProjectMode> {
  try {
    const project = await loadHarnessCometConfig({ root: projectRoot });
    return project.config.mode;
  } catch {
    if (override) return override;
    if (await hasPlainPlaywrightAssets(projectRoot)) return "playwright";
    return "runtime";
  }
}

async function hasPlainPlaywrightAssets(projectRoot: string): Promise<boolean> {
  try {
    await fs.access(path.join(projectRoot, "playwright.config.ts"));
    return true;
  } catch {
    return false;
  }
}
