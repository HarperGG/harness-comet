import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { HarnessError } from "./errors.js";

export type PackageManagerName = "pnpm" | "npm" | "yarn";

export interface DetectPackageManagerOptions {
  hasExecutable?: (name: PackageManagerName) => Promise<boolean>;
}

const LOCKFILE_CANDIDATES: Array<{ file: string; manager: PackageManagerName }> = [
  { file: "pnpm-lock.yaml", manager: "pnpm" },
  { file: "yarn.lock", manager: "yarn" },
  { file: "package-lock.json", manager: "npm" }
];

export async function detectPackageManager(
  root: string,
  options: DetectPackageManagerOptions = {}
): Promise<PackageManagerName> {
  const configured = await readConfiguredPackageManager(root);
  if (configured) return configured;

  for (const candidate of LOCKFILE_CANDIDATES) {
    try {
      await fs.access(path.join(root, candidate.file));
      return candidate.manager;
    } catch {
      // Try next source of truth.
    }
  }

  const hasExecutable = options.hasExecutable ?? defaultHasExecutable;
  for (const manager of ["pnpm", "npm", "yarn"] as const) {
    if (await hasExecutable(manager)) return manager;
  }

  throw new HarnessError({
    code: "PACKAGE_MANAGER_UNDETECTED",
    category: "environment",
    message: "Unable to determine package manager for this project",
    path: root
  });
}

async function readConfiguredPackageManager(root: string): Promise<PackageManagerName | undefined> {
  try {
    const raw = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")) as {
      packageManager?: unknown;
    };
    if (typeof raw.packageManager !== "string") return undefined;
    if (raw.packageManager.startsWith("pnpm@")) return "pnpm";
    if (raw.packageManager.startsWith("npm@")) return "npm";
    if (raw.packageManager.startsWith("yarn@")) return "yarn";
    return undefined;
  } catch {
    return undefined;
  }
}

async function defaultHasExecutable(name: PackageManagerName): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn(name, ["--version"], {
      stdio: "ignore",
      shell: process.platform === "win32"
    });
    child.once("exit", (code) => resolve(code === 0));
    child.once("error", () => resolve(false));
  });
}
