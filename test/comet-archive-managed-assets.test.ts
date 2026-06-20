import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve("packages/comet-adapter/assets/comet-skills/playwright");

async function readSkill(language: "en" | "zh") {
  return readFile(path.join(root, language, "comet-archive", "SKILL.md"), "utf8");
}

describe("managed comet-archive assets", () => {
  it("keeps upstream and Harness archive behavior in English", async () => {
    const skill = await readSkill("en");
    for (const marker of [
      "Final Archive Confirmation (Blocking Point)",
      "Needs adjustment or re-verification",
      "Do not archive yet",
      "archive-reopen",
      "Execute Archive",
      "ADDED`, `MODIFIED`, `REMOVED`, and `RENAMED",
      "--dry-run",
      "Lifecycle Closed Loop",
      "archive-check --change",
      "receipt, results, report, and fingerprints",
      "do not run `\"$COMET_BASH\" `\"$COMET_GUARD\""
    ]) {
      expect(skill).toContain(marker);
    }
  });

  it("keeps equivalent official-Chinese archive behavior", async () => {
    const skill = await readSkill("zh");
    for (const marker of [
      "归档前最终确认（阻塞点）",
      "需要调整或重新验证",
      "暂不归档",
      "archive-reopen",
      "执行归档",
      "ADDED`、`MODIFIED`、`REMOVED`、`RENAMED",
      "--dry-run",
      "生命周期闭环",
      "archive-check --change",
      "receipt、results、report 和 fingerprints",
      "不得重复执行归档操作"
    ]) {
      expect(skill).toContain(marker);
    }
  });
});
