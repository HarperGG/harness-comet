import { describe, expect, it } from "vitest";
import { buildPlaywrightCommand } from "./runner.js";

describe("buildPlaywrightCommand", () => {
  it("builds default pnpm playwright test command", () => {
    expect(
      buildPlaywrightCommand({
        packageManager: "pnpm",
        configFile: "playwright.config.ts",
        args: []
      })
    ).toEqual(["exec", "playwright", "test", "--config", "playwright.config.ts"]);
  });

  it("builds npm playwright test command", () => {
    expect(
      buildPlaywrightCommand({
        packageManager: "npm",
        configFile: "playwright.config.ts",
        args: []
      })
    ).toEqual(["exec", "playwright", "--", "test", "--config", "playwright.config.ts"]);
  });

  it("builds yarn playwright test command", () => {
    expect(
      buildPlaywrightCommand({
        packageManager: "yarn",
        configFile: "playwright.config.ts",
        args: []
      })
    ).toEqual(["playwright", "test", "--config", "playwright.config.ts"]);
  });

  it("passes through extra args", () => {
    expect(
      buildPlaywrightCommand({
        packageManager: "pnpm",
        configFile: "playwright.config.ts",
        args: ["tests/example.spec.ts", "--headed"]
      })
    ).toEqual([
      "exec",
      "playwright",
      "test",
      "--config",
      "playwright.config.ts",
      "tests/example.spec.ts",
      "--headed"
    ]);
  });

  it("supports reporter arguments before target tests", () => {
    expect(
      buildPlaywrightCommand({
        packageManager: "pnpm",
        configFile: "playwright.config.ts",
        args: ["--reporter=/tmp/reporter.js", "tests/example.spec.ts"]
      })
    ).toEqual([
      "exec",
      "playwright",
      "test",
      "--config",
      "playwright.config.ts",
      "--reporter=/tmp/reporter.js",
      "tests/example.spec.ts"
    ]);
  });
});
