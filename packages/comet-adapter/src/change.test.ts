import { describe, expect, it } from "vitest";
import {
  readPlaywrightHarnessDesignFromContent,
  readPlaywrightHarnessImpactFromContent
} from "./change.js";

describe("readPlaywrightHarnessImpactFromContent", () => {
  it("parses the new action-based impact section", () => {
    const impact = readPlaywrightHarnessImpactFromContent(`## Harness Playwright Impact

- Action: verify-existing
- Reason: save API changes could affect existing critical journeys
- Confirmed by: user
- Confirmed at: 2026-06-15T10:00:00.000Z
- Reviewed existing tests:
  - tests/journeys/annotation-save.spec.ts
  - tests/journeys/polygon-save.spec.ts
`);

    expect(impact).toEqual({
      action: "verify-existing",
      reason: "save API changes could affect existing critical journeys",
      confirmedBy: "user",
      confirmedAt: "2026-06-15T10:00:00.000Z",
      reviewedTests: [
        "tests/journeys/annotation-save.spec.ts",
        "tests/journeys/polygon-save.spec.ts"
      ]
    });
  });

  it("maps legacy mode-based content into the new action model", () => {
    const impact = readPlaywrightHarnessImpactFromContent(`## Harness Playwright Impact

- Mode: maintain
- Reason: same contract still applies
- Affected capabilities:
  - component: example | capability: render-page | behavior: show-page | risk: low
- Existing Playwright assets:
  - path: tests/example.spec.ts | relation: same-contract
- Preliminary decision: update
`);

    expect(impact).toEqual({
      action: "verify-existing",
      reason: "same contract still applies",
      confirmedBy: "agent",
      confirmedAt: undefined,
      reviewedTests: ["tests/example.spec.ts"],
      legacyMode: "maintain"
    });
  });
});

describe("readPlaywrightHarnessDesignFromContent", () => {
  it("parses the new plan section and target operations", () => {
    const design = readPlaywrightHarnessDesignFromContent(`## Harness Playwright Plan

- Action: update-or-create

### Target tests

- path: tests/journeys/annotation-save.spec.ts | operation: update | reason: update payload contract
- path: tests/incidents/BUG-42/BUG-42.spec.ts | operation: create | reason: capture incident regression

### Related test assets

- path: tests/data/save-payload.json | reason: update expected payload

### Expected evidence

- save-payload
- final-annotation-state
`);

    expect(design).toEqual({
      action: "update-or-create",
      reason: undefined,
      targetTests: [
        {
          path: "tests/journeys/annotation-save.spec.ts",
          operation: "update",
          reason: "update payload contract"
        },
        {
          path: "tests/incidents/BUG-42/BUG-42.spec.ts",
          operation: "create",
          reason: "capture incident regression"
        }
      ],
      relatedFiles: [
        {
          path: "tests/data/save-payload.json",
          reason: "update expected payload"
        }
      ],
      expectedEvidence: ["save-payload", "final-annotation-state"]
    });
  });
});
