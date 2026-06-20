import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const phases = ["open", "design", "build", "verify", "archive"] as const;
const languages = ["en", "zh"] as const;
const managedRoot = path.resolve("packages/comet-adapter/assets/comet-skills/playwright");
const snapshotRoot = path.resolve("test/fixtures/comet-upstream");

function stripHarnessBlocks(content: string): string {
  const startPrefix = "<!-- HARNESS-COMET:BEGIN ";
  const endPrefix = "<!-- HARNESS-COMET:END ";
  let result = content;

  while (true) {
    const start = result.indexOf(startPrefix);
    if (start === -1) return result;
    const end = result.indexOf(endPrefix, start);
    if (end === -1) throw new Error("Unclosed HARNESS-COMET overlay block");
    const endOfComment = result.indexOf("-->", end);
    if (endOfComment === -1) throw new Error("Invalid HARNESS-COMET overlay end marker");
    const removeThrough = endOfComment + 3 + 2;
    result = result.slice(0, start) + result.slice(removeThrough);
  }
}

describe("managed Comet skill overlays", () => {
  for (const language of languages) {
    for (const phase of phases) {
      it(`${language}/comet-${phase} preserves upstream text byte-for-byte`, async () => {
        const [managed, upstream] = await Promise.all([
          readFile(path.join(managedRoot, language, `comet-${phase}`, "SKILL.md"), "utf8"),
          readFile(path.join(snapshotRoot, language, `comet-${phase}`, "SKILL.md"), "utf8")
        ]);

        expect(stripHarnessBlocks(managed)).toBe(upstream);
        expect(managed).toContain("<!-- HARNESS-COMET:BEGIN ");
        expect(managed).toContain("<!-- HARNESS-COMET:END ");
      });
    }
  }

  it("keeps the Harness/Playwright lifecycle connected across phases", async () => {
    const read = (phase: (typeof phases)[number]) =>
      readFile(path.join(managedRoot, "en", `comet-${phase}`, "SKILL.md"), "utf8");
    const [open, design, build, verify, archive] = await Promise.all(phases.map(read));

    expect(open).toContain("## Playwright Impact Analysis");
    expect(open).toContain("## Playwright Authoring Decision");
    expect(open).toContain("harness-comet comet hook open --change");
    expect(design).toContain("playwright-authoring-plan");
    expect(design).toContain("## Playwright Authoring Plan");
    expect(design).toContain("harness-comet comet hook design --change");
    expect(build).toContain("playwright-authoring-build");
    expect(build).toContain("playwright-authoring-verify");
    expect(build).toContain("harness-comet comet hook build --change");
    expect(verify).toContain("harness-comet comet verify --change");
    expect(verify).toContain("results, report, receipt, fingerprints");
    expect(archive).toContain("harness-comet comet archive-check --change");
    expect(archive).toContain("receipt, results, report, and fingerprints");
  });
});
