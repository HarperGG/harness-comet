import { describe, expect, it } from "vitest";
import { buildPlaywrightCommand } from "./runner.js";

describe("buildPlaywrightCommand", () => {
  it("builds default playwright test command", () => {
    expect(
      buildPlaywrightCommand({
        configFile: "playwright.config.ts",
        args: []
      })
    ).toEqual(["exec", "playwright", "test", "--config", "playwright.config.ts"]);
  });

  it("passes through extra args", () => {
    expect(
      buildPlaywrightCommand({
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
});
