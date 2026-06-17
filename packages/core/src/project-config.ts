import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import { HarnessCometConfigV1Schema, type HarnessCometConfigV1 } from "@hapergg/harness-comet-schema";
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

const DEFAULT_CONFIG_FILE = "harness-comet.config.ts";

export async function loadHarnessCometConfig(
  options: LoadHarnessCometConfigOptions = {}
): Promise<LoadedHarnessCometConfig> {
  const root = path.resolve(options.root ?? process.cwd());
  const configPath = options.config
    ? path.resolve(root, options.config)
    : path.join(root, DEFAULT_CONFIG_FILE);

  const fs = await import("node:fs/promises");
  try {
    await fs.access(configPath);
  } catch {
    throw new HarnessError({
      code: "CONFIG_NOT_FOUND",
      category: "config",
      message: `Missing ${DEFAULT_CONFIG_FILE}`
    });
  }

  try {
    const jiti = createJiti(pathToFileURL(configPath).href, { interopDefault: true });
    const loaded = await jiti.import(configPath, { default: true });
    const raw = normalizeMode(loaded);
    const config = HarnessCometConfigV1Schema.parse(raw);
    return { root, configPath, config };
  } catch (error) {
    if (error instanceof HarnessError) throw error;
    throw new HarnessError({
      code: "CONFIG_INVALID",
      category: "config",
      message: error instanceof Error ? error.message : String(error),
      file: configPath
    });
  }
}

function normalizeMode(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const record = raw as Record<string, unknown>;
  if (record.mode) return record;
  return { ...record, mode: "runtime" };
}
