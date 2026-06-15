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
