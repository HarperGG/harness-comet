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
  const legacyPlaywrightPackage = ["@harness", "comet/playwright"].join("-");

  it("creates a minimal Playwright project without Harness-Comet config", async () => {
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
    await expect(fs.stat(path.join(root, "harness-comet.config.ts"))).rejects.toBeTruthy();
    await expect(fs.stat(path.join(root, "playwright.config.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "tests", "journeys", "example-save-flow.spec.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "tests", "incidents", "README.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "tests", "data", "example-input.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "tests", "data", "example-expected-payload.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "tests", "support", "mock-api.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "tests", "support", "attachments.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "tests", "fixtures.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "docs", "testing", "README.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "docs", "testing", "authoring-guide.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "docs", "testing", "incident-guide.md"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "docs", "testing", "acceptance-criteria.md"))).resolves.toBeTruthy();
  });

  it("adds only Playwright dependencies unless skipped", async () => {
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
      peerDependencies?: Record<string, string>;
    };
    expect(pkg.devDependencies["@playwright/test"]).toBe("^1.60.0");
    expect(pkg.devDependencies).not.toHaveProperty("@hapergg/harness-comet-playwright");
    expect(pkg.devDependencies).not.toHaveProperty(legacyPlaywrightPackage);
    expect(pkg.peerDependencies).toBeUndefined();
  });

  it("writes a plain Playwright config template", async () => {
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
    expect(config).not.toContain('@hapergg/harness-comet-playwright/reporter');
    expect(config).toContain('screenshot: "only-on-failure"');
    expect(config).toContain('video: "retain-on-failure"');
    expect(config).toContain('name: "chromium"');
  });

  it("adds Playwright output directories to .gitignore", async () => {
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

    const gitignore = await fs.readFile(path.join(root, ".gitignore"), "utf8");
    expect(gitignore).toContain("test-results");
    expect(gitignore).toContain("playwright-report");
  });

  it("writes an incident-friendly example spec and support helpers", async () => {
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

    const spec = await fs.readFile(
      path.join(root, "tests", "journeys", "example-save-flow.spec.ts"),
      "utf8"
    );
    expect(spec).toContain('tag: ["@annotation-save"]');
    expect(spec).not.toContain("@harness");
    expect(spec).toContain("attachJson");
    expect(spec).toContain("mockJson");
    expect(spec).toContain("http://playwright.local");

    const helper = await fs.readFile(path.join(root, "tests", "support", "attachments.ts"), "utf8");
    expect(helper).toContain("testInfo.attach");

    const testingReadme = await fs.readFile(path.join(root, "docs", "testing", "README.md"), "utf8");
    expect(testingReadme).toContain("This project uses Playwright for browser tests.");
    expect(testingReadme).not.toContain("Harness-Comet");
  });
});
