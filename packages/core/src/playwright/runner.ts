import { spawn } from "node:child_process";
import type { PackageManagerName } from "../package-manager.js";
import { detectPackageManager } from "../package-manager.js";

export interface BuildPlaywrightCommandOptions {
  packageManager: PackageManagerName;
  configFile: string;
  args: string[];
}

export function buildPlaywrightCommand(options: BuildPlaywrightCommandOptions): string[] {
  if (options.packageManager === "npm") {
    return ["exec", "playwright", "--", "test", "--config", options.configFile, ...options.args];
  }
  if (options.packageManager === "yarn") {
    return ["playwright", "test", "--config", options.configFile, ...options.args];
  }
  return ["exec", "playwright", "test", "--config", options.configFile, ...options.args];
}

export interface RunPlaywrightHarnessOptions {
  root: string;
  configFile: string;
  args: string[];
  env?: NodeJS.ProcessEnv;
}

export async function runPlaywrightHarness(options: RunPlaywrightHarnessOptions): Promise<number> {
  const packageManager = await detectPackageManager(options.root);
  const args = buildPlaywrightCommand({
    packageManager,
    configFile: options.configFile,
    args: options.args
  });
  return new Promise((resolve) => {
    const child = spawn(packageManager, args, {
      cwd: options.root,
      env: {
        ...process.env,
        ...options.env
      },
      stdio: "inherit",
      shell: process.platform === "win32"
    });
    child.on("exit", (code) => resolve(code ?? 10));
    child.on("error", () => resolve(10));
  });
}
