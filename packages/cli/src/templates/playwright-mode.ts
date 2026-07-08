export function playwrightHarnessCometConfigTemplate(testDir = "tests"): string {
  return `export default {
  schemaVersion: 1,
  mode: "playwright",
  playwright: {
    configFile: "playwright.config.ts",
    testDir: "${testDir}",
    testMatch: ["**/*.spec.ts"],
    assetRoots: ["${testDir}"],
    resultsFile: "test-results/harness-comet/results.json"
  },
  docs: {
    testingDir: "docs/testing"
  },
  incidents: {
    directory: "${testDir}/incidents",
    requireIssueUrl: false,
    requireReadme: true
  },
  validation: {
    forbidOnly: true,
    longWaitWarningMs: 5000
  }
};
`;
}

export function playwrightConfigTemplate(
  testDir = "tests",
  options: { includeHarnessReporter?: boolean } = {}
): string {
  const reporter = options.includeHarnessReporter
    ? `[["list"], ["html", { open: "never" }], ["@hapergg/harness-comet-playwright/reporter"]]`
    : `[["list"], ["html", { open: "never" }]]`;

  return `import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "${testDir}",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: ${reporter},
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

export function playwrightExampleSpecTemplate(
  options: { includeHarnessTag?: boolean } = {}
): string {
  const tagList = options.includeHarnessTag
    ? `["@harness", "@annotation-save"]`
    : `["@annotation-save"]`;
  const origin = options.includeHarnessTag ? "http://harness.local" : "http://playwright.local";

  return `import { expect, test } from "@playwright/test";
import input from "../data/example-input.json" with { type: "json" };
import expectedPayload from "../data/example-expected-payload.json" with { type: "json" };
import { attachJson } from "../support/attachments";
import { mockJson } from "../support/mock-api";

test(
  "Example save flow",
  {
    tag: ${tagList}
  },
  async ({ page }, testInfo) => {
    const captured: unknown[] = [];
    const origin = "${origin}";

    await page.route(\`${origin}/\`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: \`
          <!doctype html>
          <html>
            <body>
              <main>
                <h1>Annotation Editor</h1>

                <label>
                  Label
                  <input data-testid="label" />
                </label>

                <label>
                  Comment
                  <textarea data-testid="comment"></textarea>
                </label>

                <button data-testid="save">Save</button>
                <output data-testid="status"></output>
              </main>

              <script>
                async function bootstrap() {
                  const response = await fetch("/api/bootstrap");
                  window.__bootstrap = await response.json();
                }

                document
                  .querySelector('[data-testid="save"]')
                  .addEventListener("click", async () => {
                    const payload = {
                      id: "annotation-1",
                      label: document.querySelector(
                        '[data-testid="label"]'
                      ).value,
                      comment: document.querySelector(
                        '[data-testid="comment"]'
                      ).value
                    };

                    await fetch("/api/annotations", {
                      method: "POST",
                      headers: {
                        "content-type": "application/json"
                      },
                      body: JSON.stringify(payload)
                    });

                    document.querySelector(
                      '[data-testid="status"]'
                    ).textContent = "Saved";
                  });

                bootstrap();
              </script>
            </body>
          </html>
        \`
      });
    });

    await mockJson(page, \`${origin}/api/bootstrap\`, {
      featureFlags: {
        annotationSave: true
      }
    });

    await page.route(\`${origin}/api/annotations\`, async (route) => {
      const request = route.request();

      captured.push(
        JSON.parse(request.postData() ?? "{}")
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          saved: true
        })
      });
    });

    await page.goto(origin);

    await expect
      .poll(() =>
        page.evaluate(() =>
          Boolean(
            window.__bootstrap?.featureFlags?.annotationSave
          )
        )
      )
      .toBe(true);

    await page
      .getByTestId("label")
      .fill((input as { label: string }).label);

    await page
      .getByTestId("comment")
      .fill((input as { comment: string }).comment);

    await page.getByTestId("save").click();

    await expect(
      page.getByTestId("status")
    ).toHaveText("Saved");

    expect(captured[0]).toEqual(expectedPayload);

    await attachJson(
      testInfo,
      "captured-payload",
      captured[0]
    );
  }
);
`;
}

export function playwrightFixturesTemplate(): string {
  return `export const testBaseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
`;
}

export function playwrightMockApiTemplate(): string {
  return `import type { Page } from "@playwright/test";

export async function mockJson(
  page: Page,
  url: string,
  body: unknown,
  status = 200
): Promise<void> {
  await page.route(url, async (route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body)
    });
  });
}
`;
}

export function playwrightAttachmentsTemplate(): string {
  return `import type { TestInfo } from "@playwright/test";

export async function attachJson(testInfo: TestInfo, name: string, value: unknown): Promise<void> {
  await testInfo.attach(\`\${name}.json\`, {
    body: Buffer.from(JSON.stringify(value, null, 2)),
    contentType: "application/json"
  });
}
`;
}

export function playwrightIncidentReadmeTemplate(): string {
  return `# Incident Tests

Store incident-focused Playwright assets here. Each incident should have:

- an incident metadata file
- a focused spec
- input and expected payload fixtures
- a README describing reproduction and verification notes
`;
}

export function playwrightAuthoringGuideTemplate(): string {
  return `# Authoring Guide

Prefer one business behavior per Playwright test file. Keep the test focused on:

- deterministic fixtures
- request mocking
- payload capture
- clear assertions
- attached JSON evidence
`;
}

export function playwrightIncidentGuideTemplate(
  options: { includeHarnessComet?: boolean } = {}
): string {
  if (options.includeHarnessComet) {
    return `# Incident Guide

Use \`harness-comet create incident <id>\` to scaffold incident assets, then keep the spec and fixture files close to the incident metadata.
`;
  }

  return `# Incident Guide

Keep incident-focused Playwright tests close to their supporting data and reproduction notes.
`;
}

export function playwrightAcceptanceCriteriaTemplate(
  options: { includeHarnessComet?: boolean } = {}
): string {
  if (options.includeHarnessComet) {
    return `# Acceptance Criteria

Every Playwright Harness change should leave behind:

- declared target tests
- verification evidence
- results JSON
- a markdown verify report
- a receipt that archive-check can validate
`;
  }

  return `# Acceptance Criteria

Every Playwright test change should leave behind:

- clear target tests
- deterministic fixtures
- useful assertions
- reproducible verification commands
`;
}

export function testingReadmeTemplate(options: { includeHarnessComet?: boolean } = {}): string {
  if (options.includeHarnessComet) {
    return `# Testing

This project uses Playwright mode for Harness-Comet.

Playwright owns test execution through \`playwright.config.ts\`.
Harness-Comet owns business scenario metadata, Comet impact decisions, verification evidence, and archive checks.

Keep tests focused on business behavior. Add helper files and directories only when the project needs them.
`;
  }

  return `# Testing

This project uses Playwright for browser tests.

Playwright owns test execution through \`playwright.config.ts\`.

Keep tests focused on business behavior. Add helper files and directories only when the project needs them.
`;
}
