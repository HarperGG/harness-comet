import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initHarnessProject } from "./commands/init.js";
import { buildProgram } from "./index.js";
import {
  HARNESS_COMET_ADAPTER_MEMORY_PACKAGE,
  HARNESS_COMET_PLAYWRIGHT_DEPENDENCY,
  HARNESS_COMET_PLAYWRIGHT_PACKAGE
} from "./package-info.js";

describe("cli init", () => {
  const legacyPlaywrightPackage = ["@harness", "comet/playwright"].join("-");

  it("creates memory templates", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-"));
    const program = buildProgram();
    await program.parseAsync([
      "node",
      "harness-comet",
      "--root",
      root,
      "init",
      "--mode",
      "runtime",
      "--adapter",
      "memory",
      "--yes"
    ]);
    await expect(readFile(path.join(root, "harness-comet.config.ts"), "utf8")).resolves.toContain(
      HARNESS_COMET_ADAPTER_MEMORY_PACKAGE
    );
    await expect(
      readFile(path.join(root, "harness/scenarios/example-smoke.scenario.yaml"), "utf8")
    ).resolves.toContain("memory.set");
  });

  it("writes npm package specs for Playwright mode dependencies", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-playwright-"));
    const program = buildProgram();
    await program.parseAsync([
      "node",
      "harness-comet",
      "--root",
      root,
      "init",
      "--mode",
      "playwright",
      "--skip-install",
      "--skip-browsers",
      "--yes"
    ]);

    const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };

    expect(pkg.devDependencies?.[HARNESS_COMET_PLAYWRIGHT_PACKAGE]).toBe(
      HARNESS_COMET_PLAYWRIGHT_DEPENDENCY
    );
    expect(pkg.devDependencies?.[HARNESS_COMET_PLAYWRIGHT_PACKAGE]).not.toMatch(/^file:/);
    expect(pkg.devDependencies?.[HARNESS_COMET_PLAYWRIGHT_PACKAGE]).not.toContain("workspace:");
    expect(pkg.devDependencies).not.toHaveProperty(legacyPlaywrightPackage);
    expect(pkg.peerDependencies).toBeUndefined();
  });

  it("fails clearly when dependency installation fails after assets are written", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-install-fail-"));
    const fakeBin = await fakePackageManager(
      `#!/bin/sh
echo "install failed" >&2
exit 1
`
    );
    const originalPath = process.env.PATH;
    process.env.PATH = fakeBin;
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "target", private: true, packageManager: "pnpm@8.6.12" }, null, 2)}\n`,
      "utf8"
    );

    try {
      await expect(
        initHarnessProject({
          root,
          mode: "playwright",
          adapter: "memory",
          install: true,
          installBrowsers: false
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: "PLAYWRIGHT_DEPENDENCY_INSTALL_FAILED",
          hint: "Run: pnpm install"
        })
      );
      await expect(readFile(path.join(root, "harness-comet.config.ts"), "utf8")).resolves.toContain(
        'mode: "playwright"'
      );
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it("fails clearly when Chromium installation fails after dependency install succeeds", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-browser-fail-"));
    const fakeBin = await fakePackageManager(
      `#!/bin/sh
if [ "$1" = "install" ]; then
  exit 0
fi
echo "browser install failed" >&2
exit 1
`
    );
    const originalPath = process.env.PATH;
    process.env.PATH = fakeBin;
    await writeFile(
      path.join(root, "package.json"),
      `${JSON.stringify({ name: "target", private: true, packageManager: "pnpm@8.6.12" }, null, 2)}\n`,
      "utf8"
    );

    try {
      await expect(
        initHarnessProject({
          root,
          mode: "playwright",
          adapter: "memory",
          install: true,
          installBrowsers: true
        })
      ).rejects.toEqual(
        expect.objectContaining({
          code: "PLAYWRIGHT_BROWSER_INSTALL_FAILED",
          hint: "Run: pnpm exec playwright install chromium"
        })
      );
    } finally {
      process.env.PATH = originalPath;
    }
  });
});

async function fakePackageManager(script: string): Promise<string> {
  const binDir = await mkdtemp(path.join(tmpdir(), "harness-cli-fake-bin-"));
  const pnpmPath = path.join(binDir, "pnpm");
  await writeFile(pnpmPath, script, "utf8");
  await chmod(pnpmPath, 0o755);
  return binDir;
}
