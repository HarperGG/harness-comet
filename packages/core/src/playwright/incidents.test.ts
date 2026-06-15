import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validatePlaywrightIncidents } from "./incidents.js";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-playwright-incidents-"));
}

describe("validatePlaywrightIncidents", () => {
  it("accepts a valid incident asset", async () => {
    const root = await tempProject();
    const incidentDir = path.join(root, "tests", "incidents", "BUG-1842");
    await fs.mkdir(incidentDir, { recursive: true });
    await fs.writeFile(
      path.join(incidentDir, "incident.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "BUG-1842",
          title: "dragging polygon vertex duplicates coordinates",
          issueUrl: "https://example.com/issues/BUG-1842",
          status: "created",
          createdAt: "2026-06-15T10:00:00.000Z",
          testFile: "BUG-1842.spec.ts"
        },
        null,
        2
      )
    );
    await fs.writeFile(path.join(incidentDir, "BUG-1842.spec.ts"), "export {};\n");
    await fs.writeFile(path.join(incidentDir, "input.json"), "{}\n");
    await fs.writeFile(path.join(incidentDir, "expected.json"), "{}\n");
    await fs.writeFile(path.join(incidentDir, "README.md"), "# BUG-1842\n");

    const result = await validatePlaywrightIncidents(root, {
      incidentsDirectory: "tests/incidents",
      requireIssueUrl: false,
      requireReadme: true
    });

    expect(result.errors).toEqual([]);
    expect(result.incidents).toHaveLength(1);
  });

  it("reports invalid incident metadata and files", async () => {
    const root = await tempProject();
    const incidentDir = path.join(root, "tests", "incidents", "BUG-1842");
    await fs.mkdir(incidentDir, { recursive: true });
    await fs.writeFile(
      path.join(incidentDir, "incident.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "BUG 1842",
          title: "",
          status: "created",
          createdAt: "not-a-date",
          testFile: "../escape.spec.ts"
        },
        null,
        2
      )
    );
    await fs.writeFile(path.join(incidentDir, "input.json"), "{oops", "utf8");

    const result = await validatePlaywrightIncidents(root, {
      incidentsDirectory: "tests/incidents",
      requireIssueUrl: true,
      requireReadme: true
    });

    expect(result.errors.map((error) => error.code)).toEqual(
      expect.arrayContaining([
        "PLAYWRIGHT_INCIDENT_INVALID",
        "PLAYWRIGHT_INCIDENT_JSON_INVALID",
        "PLAYWRIGHT_INCIDENT_README_MISSING"
      ])
    );
  });
});
