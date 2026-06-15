import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import type { CometCliStatus } from "../types.js";
import { SUPPORTED_COMET_RANGE, isSupportedCometVersion } from "../compatibility/version.js";

const execFileAsync = promisify(execFile);

export function getCometBinary(): string {
  return process.env.HARNESS_COMET_COMET_BIN || "comet";
}

export async function detectCometCli(projectRoot: string): Promise<CometCliStatus> {
  const binary = getCometBinary();
  try {
    const { stdout, stderr } = await execFileAsync(binary, ["--version"], { cwd: projectRoot });
    const output = `${stdout}\n${stderr}`.trim();
    const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
    if (!versionMatch) {
      return {
        installed: true,
        supported: false,
        supportedRange: SUPPORTED_COMET_RANGE,
        error: `Unable to parse Comet version from output: ${output || "<empty>"}`,
        version: output || undefined
      };
    }
    const version = versionMatch[1];
    return {
      installed: true,
      version,
      supported: isSupportedCometVersion(version),
      supportedRange: SUPPORTED_COMET_RANGE,
      error: isSupportedCometVersion(version) ? undefined : `Unsupported Comet version: ${version}`
    };
  } catch (error) {
    return {
      installed: false,
      supported: false,
      supportedRange: SUPPORTED_COMET_RANGE,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function runCometProjectInit(
  projectRoot: string,
  options: { yes?: boolean } = {}
): Promise<void> {
  const args = ["init", "--scope", "project"];
  if (options.yes) args.push("--yes");
  args.push(projectRoot);
  if (!options.yes) {
    await spawnCometInteractive(args, projectRoot);
    return;
  }
  await execFileAsync(getCometBinary(), args, {
    cwd: projectRoot,
    maxBuffer: 1024 * 1024 * 10
  });
}

async function spawnCometInteractive(args: string[], projectRoot: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(getCometBinary(), args, {
      cwd: projectRoot,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      const suffix = signal ? `signal ${signal}` : `exit code ${code ?? "unknown"}`;
      reject(new Error(`Comet init failed with ${suffix}`));
    });
  });
}
