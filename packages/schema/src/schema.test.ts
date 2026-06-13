import { describe, expect, it } from "vitest";
import { FixtureMetadataV1Schema, ScenarioV1Schema } from "./index.js";

describe("ScenarioV1Schema", () => {
  it("accepts a valid scenario and rejects invalid ids", () => {
    expect(() =>
      ScenarioV1Schema.parse({
        schemaVersion: 1,
        id: "todo-create-item",
        title: "Create item",
        steps: [{ action: "memory.set", input: { key: "todo", value: "Write PRD" } }],
        assertions: [
          {
            inspect: "memory.get",
            oracle: "value.equals",
            input: { key: "todo" },
            expected: "Write PRD"
          }
        ]
      })
    ).not.toThrow();

    expect(() =>
      ScenarioV1Schema.parse({
        schemaVersion: 1,
        id: "Bad ID",
        title: "Bad",
        steps: [],
        assertions: []
      })
    ).toThrow();
  });
});

describe("FixtureMetadataV1Schema", () => {
  it("requires exactly one fixture data source", () => {
    expect(() =>
      FixtureMetadataV1Schema.parse({ schemaVersion: 1, id: "abc", inline: { ok: true } })
    ).not.toThrow();
    expect(() => FixtureMetadataV1Schema.parse({ schemaVersion: 1, id: "abc" })).toThrow();
  });
});
