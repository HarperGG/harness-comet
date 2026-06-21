import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve("packages/comet-adapter/assets/comet-skills/playwright");

describe("archive project knowledge assets", () => {
  it.each([
    ["en", "Project Knowledge Update", "Final Archive Confirmation"],
    ["zh", "项目知识更新", "归档前最终确认"]
  ])("places the %s knowledge review before final preflight", async (language, heading, confirmation) => {
    const content = await readFile(path.join(root, language, "comet-archive", "SKILL.md"), "utf8");
    const knowledge = content.indexOf("HARNESS-COMET:BEGIN archive-project-knowledge");
    const preflight = content.indexOf("HARNESS-COMET:BEGIN archive-preflight");
    const finalConfirmation = content.indexOf(confirmation);

    expect(content).toContain(heading);
    expect(content).toContain(".agents/rules.md");
    expect(content).toContain(".agents/structure.md");
    expect(knowledge).toBeGreaterThan(-1);
    expect(preflight).toBeGreaterThan(knowledge);
    expect(finalConfirmation).toBeGreaterThan(preflight);
  });

  it("requires explicit user evidence and diff disclosure", async () => {
    const english = await readFile(path.join(root, "en", "comet-archive", "SKILL.md"), "utf8");
    expect(english).toContain("explicit user statement");
    expect(english).toContain("proposed diff");
    expect(english).toContain("Skip knowledge update");
  });

  it("keeps the Chinese workflow equally decision-gated", async () => {
    const chinese = await readFile(path.join(root, "zh", "comet-archive", "SKILL.md"), "utf8");
    expect(chinese).toContain("用户明确表达");
    expect(chinese).toContain("拟议 diff");
    expect(chinese).toContain("跳过知识更新");
  });
});
