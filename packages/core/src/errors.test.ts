import { describe, expect, it } from "vitest";
import { HarnessError, mapErrorToExitCode } from "./errors.js";

describe("mapErrorToExitCode", () => {
  it("maps stable Part A categories", () => {
    expect(
      mapErrorToExitCode(new HarnessError({ code: "X", category: "selection", message: "bad" }))
    ).toBe(2);
    expect(
      mapErrorToExitCode(new HarnessError({ code: "X", category: "adapter", message: "bad" }))
    ).toBe(3);
    expect(
      mapErrorToExitCode(new HarnessError({ code: "X", category: "action", message: "bad" }))
    ).toBe(4);
  });
});
