import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { detectPackageManager } from "./package-manager.js";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-package-manager-"));
}

describe("detectPackageManager", () => {
  it("prefers package.json.packageManager", async () => {
    const root = await tempProject();
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ packageManager: "npm@10.8.2" }, null, 2)
    );
    await fs.writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'");

    await expect(detectPackageManager(root)).resolves.toBe("npm");
  });

  it("falls back to lockfiles when packageManager is absent", async () => {
    const root = await tempProject();
    await fs.writeFile(path.join(root, "yarn.lock"), "");

    await expect(detectPackageManager(root)).resolves.toBe("yarn");
  });

  it("falls back to executable probing when project files are inconclusive", async () => {
    const root = await tempProject();

    await expect(
      detectPackageManager(root, {
        hasExecutable: async (name) => name === "npm"
      })
    ).resolves.toBe("npm");
  });

  it("throws when package manager cannot be determined", async () => {
    const root = await tempProject();

    await expect(
      detectPackageManager(root, {
        hasExecutable: async () => false
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: "PACKAGE_MANAGER_UNDETECTED",
        category: "environment"
      })
    );
  });
});
