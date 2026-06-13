import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";
import { HarnessConfigV1Schema, type HarnessConfigV1 } from "@harness-comet/schema";
import { HarnessError } from "./errors.js";

export interface LoadedHarnessConfig {
  projectRoot: string;
  configPath: string;
  config: HarnessConfigV1;
  paths: {
    scenarios: string;
    fixtures: string;
    adapters: string;
    oracles: string;
  };
}

export interface LoadConfigOptions {
  root?: string;
  config?: string;
}

export function resolveInsideRoot(projectRoot: string, target: string, label: string): string {
  const resolved = path.resolve(projectRoot, target);
  const relative = path.relative(projectRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new HarnessError({
      code: "PATH_OUTSIDE_ROOT",
      category: "config",
      message: `${label} must stay inside project root`,
      path: target
    });
  }
  return resolved;
}

export async function loadHarnessConfig(
  options: LoadConfigOptions = {}
): Promise<LoadedHarnessConfig> {
  const projectRoot = path.resolve(options.root ?? process.cwd());
  const configPath = options.config
    ? path.resolve(projectRoot, options.config)
    : await firstExistingConfig(projectRoot);
  if (!configPath) {
    throw new HarnessError({
      code: "CONFIG_NOT_FOUND",
      category: "config",
      message: "Harness config not found",
      hint: "Run harness-comet init first"
    });
  }

  try {
    const jiti = createJiti(pathToFileURL(configPath).href, { interopDefault: true });
    const loaded = await jiti.import(configPath, { default: true });
    const config = HarnessConfigV1Schema.parse(loaded);
    const rootDir = config.rootDir
      ? resolveInsideRoot(projectRoot, config.rootDir, "rootDir")
      : projectRoot;
    return {
      projectRoot: rootDir,
      configPath,
      config,
      paths: {
        scenarios: resolveInsideRoot(
          rootDir,
          config.paths?.scenarios ?? "harness/scenarios",
          "scenarios path"
        ),
        fixtures: resolveInsideRoot(
          rootDir,
          config.paths?.fixtures ?? "harness/fixtures",
          "fixtures path"
        ),
        adapters: resolveInsideRoot(
          rootDir,
          config.paths?.adapters ?? "harness/adapters",
          "adapters path"
        ),
        oracles: resolveInsideRoot(
          rootDir,
          config.paths?.oracles ?? "harness/oracles",
          "oracles path"
        )
      }
    };
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

async function firstExistingConfig(projectRoot: string): Promise<string | undefined> {
  const fs = await import("node:fs/promises");
  for (const name of ["harness.config.ts", "harness.config.mts"]) {
    const full = path.join(projectRoot, name);
    try {
      await fs.access(full);
      return full;
    } catch {
      // try next
    }
  }
  return undefined;
}
