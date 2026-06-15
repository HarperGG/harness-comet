import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { REQUIRED_SKILL_ROOT_FILES } from "../compatibility/file-contract.js";
import { discoverProjectSkillRoots } from "./detector.js";

async function seedSkillRoot(projectRoot: string, skillRoot: string, full = true): Promise<void> {
  for (const relativePath of full
    ? REQUIRED_SKILL_ROOT_FILES
    : REQUIRED_SKILL_ROOT_FILES.filter((item) => item !== "comet-verify/SKILL.md")) {
    const fullPath = path.join(projectRoot, skillRoot, relativePath);
    await mkdir(path.dirname(fullPath), { recursive: true });
    await writeFile(fullPath, "stub\n", "utf8");
  }
}

describe("project target discovery", () => {
  it("returns zero targets for an empty project", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "detector-empty-"));
    const result = await discoverProjectSkillRoots(root);
    expect(result).toEqual([]);
  });

  it("discovers valid and invalid project-local targets", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "detector-targets-"));
    await mkdir(path.join(root, ".codex"), { recursive: true });
    await mkdir(path.join(root, ".cursor"), { recursive: true });
    await seedSkillRoot(root, ".codex/skills", true);
    await seedSkillRoot(root, ".cursor/skills", false);
    const result = await discoverProjectSkillRoots(root);
    expect(result).toHaveLength(2);
    expect(result.find((item) => item.platformId === "codex")?.valid).toBe(true);
    expect(result.find((item) => item.platformId === "cursor")?.valid).toBe(false);
  });
});
