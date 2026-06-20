import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { execa } from "execa";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "comet-open-hook-"));
  const change = "add-global-menu";
  const dir = path.join(root, "openspec", "changes", change);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(root, "harness-comet.config.ts"), `export default { schemaVersion: 1, mode: "playwright", playwright: { configFile: "playwright.config.ts", testDir: "tests", testMatch: ["**/*.spec.ts"], assetRoots: ["tests"], resultsFile: "test-results/harness-comet/results.json" }, docs: { testingDir: "docs/testing" }, incidents: { directory: "tests/incidents", requireIssueUrl: false, requireReadme: true }, validation: { forbidOnly: true, longWaitWarningMs: 5000 } };\n`);
  await writeFile(path.join(dir, ".comet.yaml"), "phase: open\ndesign_doc: null\n");
  await writeFile(path.join(dir, "proposal.md"), `# Proposal\n\n## Playwright Impact Analysis\n\n- Changed behavior: global menu is added.\n\n## Playwright Authoring Decision\n\n\`\`\`yaml\nplaywrightAuthoringDecision:\n  enabled: true\n  confirmedBy: user\n  targets:\n    - path: tests/journeys/navigation.spec.ts\n      operation: update\n      reason: Cover the new menu.\n\`\`\`\n`);
  await writeFile(path.join(dir, "tasks.md"), "# Tasks\n\n- [ ] Playwright planning\n- [ ] Playwright implementation\n- [ ] Playwright verification\n");
  return { root, change, proposalPath: path.join(dir, "proposal.md") };
}

describe("Playwright Comet open hook", () => {
  it("does not require design_doc during Open", async () => {
    const { root, change } = await fixture();
    const result = await execa("pnpm", [...cli, "--root", root, "comet", "hook", "open", "--change", change]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("passed");
  });

  it("rejects legacy aggregate operations", async () => {
    const { root, change, proposalPath } = await fixture();
    const proposal = await readFile(proposalPath, "utf8");
    await writeFile(proposalPath, proposal.replace("operation: update", "operation: update-or-create"));
    const result = await execa("pnpm", [...cli, "--root", root, "comet", "hook", "open", "--change", change], { reject: false });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Unsupported Playwright target operation");
  });
});
