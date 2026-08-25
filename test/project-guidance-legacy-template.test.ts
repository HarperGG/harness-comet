import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initializeProjectGuidance } from "../packages/comet-adapter/src/project-guidance.js";
import {
  playwrightPolicyTemplate as legacyPlaywrightPolicyTemplate,
  rulesTemplate as legacyRulesTemplate
} from "../packages/comet-adapter/src/project-guidance-templates.js";

describe("legacy project guidance migration", () => {
  it("fully replaces untouched legacy generated prompts with the shorter on-demand policy", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "project-guidance-legacy-template-"));
    await mkdir(path.join(root, ".agents"), { recursive: true });
    await writeFile(path.join(root, ".agents", "rules.md"), legacyRulesTemplate("en"), "utf8");
    await writeFile(
      path.join(root, ".agents", "playwright.md"),
      legacyPlaywrightPolicyTemplate("en"),
      "utf8"
    );

    await initializeProjectGuidance(root, { agents: ["codex"] });

    const rules = await readFile(path.join(root, ".agents", "rules.md"), "utf8");
    const policy = await readFile(path.join(root, ".agents", "playwright.md"), "utf8");

    expect(rules).toContain("HARNESS-COMET:BEGIN playwright-guidance");
    expect(rules).toContain("authored on demand");
    expect(rules).not.toContain("When work changes user-visible behavior, implements a feature");

    expect(policy).toContain("HARNESS-COMET:BEGIN playwright-activation");
    expect(policy).toContain("Playwright authoring is on demand");
    expect(policy).not.toContain("Default testing obligation");
    expect(policy).not.toContain("Mandatory workflow");
    expect(policy.length).toBeLessThan(legacyPlaywrightPolicyTemplate("en").length);
  });
});
