import { afterEach, describe, expect, it, vi } from "vitest";

const runPlaywrightHarness = vi.fn(async () => 0);
const loadHarnessCometConfig = vi.fn(async () => ({
  root: "/tmp/project",
  configPath: "/tmp/project/harness-comet.config.ts",
  config: {
    mode: "playwright" as const,
    playwright: {
      configFile: "playwright.config.ts",
      testDir: "tests",
      testMatch: ["**/*.spec.ts"],
      resultsFile: "test-results/harness-comet/results.json"
    }
  }
}));

vi.mock("@hapergg/harness-comet-core", async () => {
  const actual = await vi.importActual<typeof import("@hapergg/harness-comet-core")>("@hapergg/harness-comet-core");
  return {
    ...actual,
    loadHarnessCometConfig,
    runPlaywrightHarness
  };
});

describe("playwright run passthrough", () => {
  afterEach(() => {
    runPlaywrightHarness.mockClear();
    loadHarnessCometConfig.mockClear();
    process.exitCode = undefined;
  });

  it("passes raw args after -- through to Playwright", async () => {
    const { main } = await import("./index.js");

    await main([
      "node",
      "harness-comet",
      "--root",
      "/tmp/project",
      "run",
      "--",
      "--grep",
      "@annotation-save",
      "tests/journeys/save.spec.ts",
      "--headed"
    ]);

    expect(runPlaywrightHarness).toHaveBeenCalledWith({
      root: "/tmp/project",
      configFile: "playwright.config.ts",
      args: ["--grep", "@annotation-save", "tests/journeys/save.spec.ts", "--headed"],
      env: {
        HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE:
          "/tmp/project/test-results/harness-comet/results.json",
        HARNESS_COMET_PLAYWRIGHT_PROJECT_ROOT: "/tmp/project"
      }
    });
  });
});
