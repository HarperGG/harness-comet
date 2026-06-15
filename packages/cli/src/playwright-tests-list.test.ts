import { afterEach, describe, expect, it, vi } from "vitest";

const listPlaywrightTests = vi.fn(async () => [
  {
    project: "chromium",
    file: "tests/journeys/save.spec.ts",
    title: "save payload stays stable",
    tags: ["@annotation-save", "@harness"],
    annotations: [{ type: "incident", description: "BUG-42" }]
  },
  {
    file: "tests/journeys/load.spec.ts",
    title: "load screen renders",
    tags: ["@load"],
    annotations: []
  }
]);

const loadHarnessCometConfig = vi.fn(async () => ({
  root: "/tmp/project",
  configPath: "/tmp/project/harness-comet.config.ts",
  config: {
    mode: "playwright" as const,
    playwright: {
      configFile: "playwright.config.ts",
      testDir: "tests",
      testMatch: ["**/*.spec.ts"]
    }
  }
}));

vi.mock("@harness-comet/core", async () => {
  const actual = await vi.importActual<typeof import("@harness-comet/core")>("@harness-comet/core");
  return {
    ...actual,
    listPlaywrightTests,
    loadHarnessCometConfig
  };
});

describe("playwright tests list", () => {
  const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

  afterEach(() => {
    stdoutWrite.mockClear();
    listPlaywrightTests.mockClear();
    loadHarnessCometConfig.mockClear();
  });

  it("filters by tag and prints a text listing", async () => {
    const { main } = await import("./index.js");

    await main([
      "node",
      "harness-comet",
      "--root",
      "/tmp/project",
      "tests",
      "list",
      "--tag",
      "@harness"
    ]);

    expect(listPlaywrightTests).toHaveBeenCalledOnce();
    expect(stdoutWrite).toHaveBeenCalledWith(
      "tests/journeys/save.spec.ts\tsave payload stays stable\t@annotation-save,@harness\n"
    );
  });

  it("prints json when requested", async () => {
    const { main } = await import("./index.js");

    await main([
      "node",
      "harness-comet",
      "--root",
      "/tmp/project",
      "--json",
      "tests",
      "list"
    ]);

    const lastCall = stdoutWrite.mock.calls.at(-1)?.[0];
    expect(typeof lastCall).toBe("string");
    expect(JSON.parse(String(lastCall))).toHaveLength(2);
  });
});
