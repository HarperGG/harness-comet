import { describe, expect, it } from "vitest";
import {
  FixtureMetadataV1Schema,
  HarnessCometConfigV1Schema,
  ScenarioV1Schema
} from "./index.js";

describe("ScenarioV1Schema", () => {
  it("accepts a valid scenario and rejects invalid ids", () => {
    expect(() =>
      ScenarioV1Schema.parse({
        schemaVersion: 1,
        id: "todo-create-item",
        title: "Create item",
        business: {
          component: "todo-list",
          capability: "create-item",
          behavior: "store-new-item",
          contract: "todo-create-item",
          status: "active"
        },
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
      FixtureMetadataV1Schema.parse({
        schemaVersion: 1,
        id: "abc",
        inline: { ok: true },
        business: {
          purpose: "todo-empty-state",
          scope: "shared",
          consumers: ["todo-create-item"]
        }
      })
    ).not.toThrow();
    expect(() => FixtureMetadataV1Schema.parse({ schemaVersion: 1, id: "abc" })).toThrow();
  });
});

describe("HarnessCometConfigV1Schema", () => {
  it("parses runtime mode config with existing runtime fields", () => {
    const parsed = HarnessCometConfigV1Schema.parse({
      schemaVersion: 1,
      mode: "runtime",
      paths: {
        scenarios: "harness/scenarios",
        fixtures: "harness/fixtures",
        adapters: "harness/adapters",
        oracles: "harness/oracles"
      },
      adapter: {
        default: "memory",
        entries: {
          memory: "@harness-comet/adapter-memory"
        }
      }
    });

    expect(parsed.mode).toBe("runtime");
  });

  it("parses playwright mode config", () => {
    const parsed = HarnessCometConfigV1Schema.parse({
      schemaVersion: 1,
      mode: "playwright",
      playwright: {
        configFile: "playwright.config.ts",
        testDir: "tests",
        testMatch: ["**/*.spec.ts"]
      },
      impact: {
        defaultMode: "maintain",
        requireOpenImpact: true,
        requireDesignDecision: true,
        requireVerifyEvidence: true
      }
    });

    expect(parsed.mode).toBe("playwright");
    if (parsed.mode === "playwright") {
      expect(parsed.playwright.testDir).toBe("tests");
    }
  });

  it("rejects runtime adapter fields inside playwright mode", () => {
    expect(() =>
      HarnessCometConfigV1Schema.parse({
        schemaVersion: 1,
        mode: "playwright",
        adapter: {
          default: "memory",
          entries: {
            memory: "@harness-comet/adapter-memory"
          }
        },
        playwright: {
          configFile: "playwright.config.ts",
          testDir: "tests",
          testMatch: ["**/*.spec.ts"]
        }
      })
    ).toThrow();
  });
});
