import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "harness-playwright-init-"));
}

describe("init --mode playwright", () => {
  it("creates a minimal Playwright mode project", async () => {
    const root = await tempProject();
    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "init",
      "--mode",
      "playwright",
      "--skip-install",
      "--skip-browsers",
      "--yes"
    ]);

    expect(result.exitCode).toBe(0);
    await expect(fs.stat(path.join(root, "harness-comet.config.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "playwright.config.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "tests", "example.spec.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "docs", "testing", "README.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "tests", "pages"))).rejects.toThrow();
    await expect(fs.stat(path.join(root, "tests", "drivers"))).rejects.toThrow();
  });

  it("adds Playwright dependencies unless skipped", async () => {
    const root = await tempProject();
    await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "target", private: true }, null, 2));

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "init",
      "--mode",
      "playwright",
      "--skip-install",
      "--skip-browsers",
      "--yes"
    ]);

    expect(result.exitCode).toBe(0);
    const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
      peerDependencies: Record<string, string>;
    };
    expect(pkg.devDependencies["@playwright/test"]).toBe("^1.60.0");
    expect(pkg.devDependencies["@harness-comet/playwright"]).toBeDefined();
    expect(pkg.peerDependencies["@playwright/test"]).toBe("^1.60.0");
  });

  it("writes a richer Playwright config template", async () => {
    const root = await tempProject();
    await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "init",
      "--mode",
      "playwright",
      "--skip-install",
      "--skip-browsers",
      "--yes"
    ]);

    const config = await fs.readFile(path.join(root, "playwright.config.ts"), "utf8");
    expect(config).toContain('testMatch: ["**/*.spec.ts"]');
    expect(config).toContain("fullyParallel: true");
    expect(config).toContain('forbidOnly: Boolean(process.env.CI)');
    expect(config).toContain('reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]]');
    expect(config).toContain('screenshot: "only-on-failure"');
    expect(config).toContain('video: "retain-on-failure"');
    expect(config).toContain('name: "chromium"');
  });
});
