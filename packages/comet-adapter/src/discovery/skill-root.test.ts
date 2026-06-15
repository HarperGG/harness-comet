import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REQUIRED_SKILL_ROOT_FILES } from "../compatibility/file-contract.js";
import { validateSkillRoot } from "./skill-root.js";

async function createValidSkillRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "skill-root-"));
  for (const relativePath of REQUIRED_SKILL_ROOT_FILES) {
    const fullPath = path.join(root, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, "stub\n", "utf8");
  }
  return root;
}

describe("skill root validation", () => {
  it("accepts a full required file set", async () => {
    const root = await createValidSkillRoot();
    const report = await validateSkillRoot("codex", root);
    expect(report.valid).toBe(true);
    expect(report.issues).toEqual([]);
  });

  it("reports missing required files", async () => {
    const root = await createValidSkillRoot();
    await import("node:fs/promises").then(({ rm }) => rm(path.join(root, "comet-verify/SKILL.md")));
    const report = await validateSkillRoot("codex", root);
    expect(report.valid).toBe(false);
    expect(report.issues[0]?.code).toBe("required-file-missing");
  });
});
