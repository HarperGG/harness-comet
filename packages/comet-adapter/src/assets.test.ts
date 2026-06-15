import { describe, expect, it } from "vitest";
import {
  applyManagedPatch,
  buildManagedPatchBlock,
  hasManagedPatch,
  removeManagedPatch
} from "./assets.js";

describe("managed skill patch blocks", () => {
  it("uses version 2 block markers", () => {
    const block = buildManagedPatchBlock("open");
    expect(block).toContain("<!-- harness-comet:start phase=open version=2 -->");
    expect(block).toContain("<!-- harness-comet:end phase=open -->");
  });

  it("uses action-based wording for playwright open patch", () => {
    const block = buildManagedPatchBlock("open", "en", "playwright");
    expect(block).toContain("none");
    expect(block).toContain("verify-existing");
    expect(block).toContain("update-or-create");
    expect(block).toContain("--confirmed-by user");
    expect(block).not.toContain("full | maintain | off");
    expect(block).not.toContain("Preliminary decision");
    expect(block).not.toContain("maintain mode");
    expect(block).not.toContain("full mode");
  });

  it("removes defineHarnessScenario wording from playwright build patch", () => {
    const block = buildManagedPatchBlock("build", "en", "playwright");
    expect(block).toContain("Do not require `defineHarnessScenario`");
    expect(block).not.toContain("Keep key business tests tagged with");
    expect(block).not.toContain("defineHarnessScenario(...)");
  });

  it("replaces an existing managed block in place", () => {
    const current = `# comet-open

Before

<!-- harness-comet:start phase=open version=1 -->
legacy block
<!-- harness-comet:end phase=open -->

After
`;

    const next = applyManagedPatch("comet-open/SKILL.md", current);
    expect(next).toContain("Before");
    expect(next).toContain("After");
    expect(next).toContain("version=2");
    expect(next).not.toContain("legacy block");
  });

  it("inserts before a completion anchor when no block exists", () => {
    const current = `# comet-verify

Upstream text.

## Completion

- Done
`;

    const next = applyManagedPatch("comet-verify/SKILL.md", current);
    const patchIndex = next.indexOf("<!-- harness-comet:start phase=verify version=2 -->");
    const anchorIndex = next.indexOf("## Completion");
    expect(patchIndex).toBeGreaterThan(-1);
    expect(anchorIndex).toBeGreaterThan(-1);
    expect(patchIndex).toBeLessThan(anchorIndex);
  });

  it.each([
    "## Completion Criteria",
    "## Before finishing",
    "## Final checks",
    "## Exit Criteria",
    "## Completion",
    "## Final Checklist",
    "## Done"
  ])("supports anchor %s", (anchor) => {
    const current = `# comet-open

Upstream text.

${anchor}

- Done
`;

    const next = applyManagedPatch("comet-open/SKILL.md", current);
    const patchIndex = next.indexOf("<!-- harness-comet:start phase=open version=2 -->");
    const anchorIndex = next.indexOf(anchor);
    expect(patchIndex).toBeGreaterThan(-1);
    expect(anchorIndex).toBeGreaterThan(-1);
    expect(patchIndex).toBeLessThan(anchorIndex);
  });

  it("does not match partial completion headings", () => {
    const current = `# comet-open

Upstream text.

## Completion Notes

- Similar but unsupported
`;

    const next = applyManagedPatch("comet-open/SKILL.md", current);
    expect(next.indexOf("<!-- harness-comet:start phase=open version=2 -->")).toBeGreaterThan(
      next.indexOf("## Completion Notes")
    );
  });

  it("appends when no supported anchor exists", () => {
    const current = `# comet-build

Only upstream content.
`;

    const next = applyManagedPatch("comet-build/SKILL.md", current);
    expect(next.trimEnd().endsWith("<!-- harness-comet:end phase=build -->")).toBe(true);
  });

  it("does not inject before anchors inside fenced code blocks", () => {
    const current = `# comet-archive

\`\`\`md
## Completion
- inside fence
\`\`\`

Tail text.
`;

    const next = applyManagedPatch("comet-archive/SKILL.md", current);
    const patchIndex = next.indexOf("<!-- harness-comet:start phase=archive version=2 -->");
    const fencedAnchorIndex = next.indexOf("## Completion");
    const tailIndex = next.indexOf("Tail text.");
    expect(patchIndex).toBeGreaterThan(tailIndex);
    expect(patchIndex).toBeGreaterThan(fencedAnchorIndex);
  });

  it("detects managed content across v1 and v2", () => {
    expect(
      hasManagedPatch(
        "comet-open/SKILL.md",
        "<!-- harness-comet:start phase=open version=1 -->\nold\n<!-- harness-comet:end phase=open -->"
      )
    ).toBe(true);
    expect(
      hasManagedPatch(
        "comet-open/SKILL.md",
        "<!-- harness-comet:start phase=open version=2 -->\nnew\n<!-- harness-comet:end phase=open -->"
      )
    ).toBe(true);
  });

  it("removes managed content for both v1 and v2 blocks", () => {
    const v1 = removeManagedPatch(
      "comet-open/SKILL.md",
      `# skill

<!-- harness-comet:start phase=open version=1 -->
old
<!-- harness-comet:end phase=open -->
`
    );
    const v2 = removeManagedPatch(
      "comet-open/SKILL.md",
      `# skill

<!-- harness-comet:start phase=open version=2 -->
new
<!-- harness-comet:end phase=open -->
`
    );

    expect(v1).not.toContain("harness-comet:start");
    expect(v2).not.toContain("harness-comet:start");
  });
});
