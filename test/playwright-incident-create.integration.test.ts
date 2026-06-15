import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "harness-playwright-incident-create-"));
}

async function initPlaywrightProject(root: string): Promise<void> {
  await execa("pnpm", [
    ...cli,
    "--root",
    root,
    "init",
    "--mode",
    "playwright",
    "--skip-install",
    "--skip-browsers",
    "--yes"
  ]);
}

describe("create incident", () => {
  it("creates incident assets in playwright mode", async () => {
    const root = await tempProject();
    await initPlaywrightProject(root);

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "create",
      "incident",
      "BUG-1842",
      "--title",
      "Dragging polygon vertex duplicates coordinates",
      "--issue-url",
      "https://example.com/issues/BUG-1842"
    ]);

    expect(result.exitCode).toBe(0);
    const incidentRoot = path.join(root, "tests", "incidents", "BUG-1842");
    await expect(fs.stat(path.join(incidentRoot, "incident.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(incidentRoot, "BUG-1842.spec.ts"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(incidentRoot, "input.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(incidentRoot, "expected.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(incidentRoot, "README.md"))).resolves.toBeTruthy();

    const metadata = JSON.parse(await fs.readFile(path.join(incidentRoot, "incident.json"), "utf8"));
    expect(metadata).toMatchObject({
      schemaVersion: 1,
      id: "BUG-1842",
      title: "Dragging polygon vertex duplicates coordinates",
      issueUrl: "https://example.com/issues/BUG-1842",
      status: "created",
      testFile: "BUG-1842.spec.ts"
    });
  });
});
