export function playwrightHarnessCometConfigTemplate(testDir = "tests"): string {
  return `export default {
  schemaVersion: 1,
  mode: "playwright",
  playwright: {
    configFile: "playwright.config.ts",
    testDir: "${testDir}",
    testMatch: ["**/*.spec.ts"]
  },
  docs: {
    testingDir: "docs/testing"
  },
  impact: {
    defaultMode: "maintain",
    requireOpenImpact: true,
    requireDesignDecision: true,
    requireVerifyEvidence: true
  }
};
`;
}

export function playwrightConfigTemplate(testDir = "tests"): string {
  return `import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "${testDir}",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  expect: {
    timeout: 10_000
  },
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" }
    }
  ]
});
`;
}

export function playwrightExampleSpecTemplate(): string {
  return `import { test, expect } from "@playwright/test";
import { defineHarnessScenario, harnessAnnotation } from "@harness-comet/playwright";

const scenario = defineHarnessScenario({
  id: "example-smoke",
  title: "Example smoke",
  component: "example",
  capability: "render-page",
  behavior: "show-example-page",
  contract: "example-page-visible",
  kind: "smoke",
  risk: "low",
  tags: ["smoke"]
});

test(scenario.title, async ({ page }, testInfo) => {
  testInfo.annotations.push(harnessAnnotation(scenario));

  await page.goto("data:text/html,<title>Harness</title><main>Hello Harness</main>");
  await expect(page.getByText("Hello Harness")).toBeVisible();
});
`;
}

export function testingReadmeTemplate(): string {
  return `# Testing

This project uses Playwright mode for Harness-Comet.

Playwright owns test execution through \`playwright.config.ts\`.
Harness-Comet owns business scenario metadata, Comet impact decisions, verification evidence, and archive checks.

Keep tests focused on business behavior. Add helper files and directories only when the project needs them.
`;
}
