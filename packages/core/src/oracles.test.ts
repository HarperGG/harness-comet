import { describe, expect, it } from "vitest";
import { createGenericOracles } from "./oracles.js";
import { silentLogger } from "./logger.js";

const context = {
  runId: "run",
  projectRoot: "/tmp",
  scenario: { schemaVersion: 1 as const, id: "abc", title: "abc", steps: [], assertions: [] },
  fixtures: new Map(),
  values: new Map(),
  signal: new AbortController().signal,
  logger: silentLogger
};

describe("generic oracles", () => {
  it("reports json equality differences", async () => {
    const result = await createGenericOracles()["json.equals"].evaluate({
      actual: { a: 1 },
      expected: { a: 2 },
      context
    });
    expect(result.passed).toBe(false);
    expect(result.differences?.[0]).toMatchObject({ path: "$.a", type: "value-mismatch" });
  });
});
