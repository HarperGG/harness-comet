import { describe, expect, it } from "vitest";
import { defineHarnessScenario, harnessAnnotation } from "./index.js";

describe("defineHarnessScenario", () => {
  it("returns normalized metadata", () => {
    const scenario = defineHarnessScenario({
      id: "annotation-polygon-create",
      title: "Create polygon annotation",
      component: "annotation",
      capability: "polygon-authoring",
      behavior: "create-polygon-and-save",
      contract: "annotation-polygon-save",
      kind: "journey",
      risk: "high",
      tags: ["annotation"]
    });

    expect(scenario.id).toBe("annotation-polygon-create");
    expect(scenario.risk).toBe("high");
  });

  it("creates a Playwright annotation", () => {
    const scenario = defineHarnessScenario({
      id: "example-smoke",
      title: "Example smoke",
      component: "example",
      capability: "render-page",
      behavior: "show-page",
      contract: "example-page-visible"
    });

    expect(harnessAnnotation(scenario)).toEqual({
      type: "harness-scenario",
      description: "example-smoke"
    });
  });
});
