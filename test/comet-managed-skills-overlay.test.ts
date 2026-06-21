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

function restoreArchiveUpstreamText(content: string, language: (typeof languages)[number]): string {
  const replacements = language === "en"
    ? [
        ["### 3. Final Archive Confirmation (Blocking Point)", "### 1. Final Archive Confirmation (Blocking Point)"],
        [
          "After project-knowledge review and archive preflight complete, **must follow the `comet/reference/decision-point.md` protocol to pause and wait for the user to confirm whether to archive immediately**.",
          "After entry verification passes, **must follow the `comet/reference/decision-point.md` protocol to pause and wait for the user to confirm whether to archive immediately**."
        ],
        ["- Project knowledge update result: updated, unnecessary, or skipped by user\n", ""],
        ["Only after the user selects \"Confirm archive\" may Step 4 continue.", "Only after the user selects \"Confirm archive\" may Step 2 continue."],
        ["### 4. Execute Archive", "### 2. Execute Archive"],
        ["### 5. Lifecycle Closed Loop", "### 3. Lifecycle Closed Loop"],
        [
          "brainstorming → delta spec → implementation → verification → project knowledge update → main spec merge → design doc annotation → archive",
          "brainstorming → delta spec → implementation → verification → main spec merge → design doc annotation → archive"
        ]
      ]
    : [
        ["### 3. 归档前最终确认（阻塞点）", "### 1. 归档前最终确认（阻塞点）"],
        [
          "项目知识更新和归档预检完成后，**必须按 `comet/reference/decision-point.md` 的协议暂停并等待用户确认是否立即归档**。",
          "入口验证通过后，**必须按 `comet/reference/decision-point.md` 的协议暂停并等待用户确认是否立即归档**。"
        ],
        ["- 项目知识更新结果：已更新、无需更新或用户选择跳过\n", ""],
        ["只有用户选择「确认归档」后，才允许继续 Step 4。", "只有用户选择「确认归档」后，才允许继续 Step 2。"],
        ["### 4. 执行归档", "### 2. 执行归档"],
        ["### 5. 生命周期闭环", "### 3. 生命周期闭环"],
        [
          "brainstorming → delta spec → 实施 → 验证 → 项目知识更新 → 主 spec 合并 → design doc 标注 → 归档",
          "brainstorming → delta spec → 实施 → 验证 → 主 spec 合并 → design doc 标注 → 归档"
        ]
      ];

  let restored = content;
  for (const [managed, upstream] of replacements) {
    expect(restored).toContain(managed);
    restored = restored.replace(managed, upstream);
  }
  return restored;
}

describe("managed Comet skill overlays", () => {
  for (const language of languages) {
    for (const phase of phases) {
      it(`${language}/comet-${phase} preserves upstream text byte-for-byte`, async () => {
        const [managed, upstream] = await Promise.all([
          readFile(path.join(managedRoot, language, `comet-${phase}`, "SKILL.md"), "utf8"),
          readFile(path.join(snapshotRoot, language, `comet-${phase}`, "SKILL.md"), "utf8")
        ]);

        const withoutBlocks = stripHarnessBlocks(managed);
        const restored = phase === "archive"
          ? restoreArchiveUpstreamText(withoutBlocks, language)
          : withoutBlocks;
        expect(restored).toBe(upstream);
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
