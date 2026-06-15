import { describe, expect, it } from "vitest";
import {
  FixtureMetadataV1Schema,
  HarnessCometConfigV1Schema,
  IncidentRecordV1Schema,
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
      incidents: {
        directory: "tests/incidents",
        requireIssueUrl: true,
        requireReadme: true
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

  it("applies playwright mode defaults for verification paths and validation", () => {
    const parsed = HarnessCometConfigV1Schema.parse({
      schemaVersion: 1,
      mode: "playwright",
      playwright: {
        configFile: "playwright.config.ts",
        testDir: "tests",
        testMatch: ["**/*.spec.ts"]
      }
    });

    expect(parsed.mode).toBe("playwright");
    if (parsed.mode === "playwright") {
      expect(parsed.playwright.assetRoots).toEqual(["tests"]);
      expect(parsed.playwright.resultsFile).toBe("test-results/harness-comet/results.json");
      expect(parsed.incidents?.directory).toBe("tests/incidents");
      expect(parsed.incidents?.requireIssueUrl).toBe(false);
      expect(parsed.incidents?.requireReadme).toBe(true);
      expect(parsed.impact).toBeUndefined();
      expect(parsed.validation?.forbidOnly).toBe(true);
      expect(parsed.validation?.longWaitWarningMs).toBe(5000);
    }
  });

  it("still accepts legacy playwright impact config when present", () => {
    const parsed = HarnessCometConfigV1Schema.parse({
      schemaVersion: 1,
      mode: "playwright",
      playwright: {
        configFile: "playwright.config.ts",
        testDir: "tests",
        testMatch: ["**/*.spec.ts"],
        assetRoots: ["tests"],
        resultsFile: "test-results/harness-comet/results.json"
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
      expect(parsed.impact?.defaultMode).toBe("maintain");
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

describe("IncidentRecordV1Schema", () => {
  it("parses valid incident metadata", () => {
    expect(() =>
      IncidentRecordV1Schema.parse({
        schemaVersion: 1,
        id: "BUG-1842",
        title: "Dragging polygon vertex duplicates coordinates",
        issueUrl: "https://example.com/issues/BUG-1842",
        status: "created",
        createdAt: "2026-06-15T10:00:00.000Z",
        testFile: "BUG-1842.spec.ts"
      })
    ).not.toThrow();
  });
});
