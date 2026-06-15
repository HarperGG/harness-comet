import { describe, expect, it } from "vitest";
import { getProjectPlatformRegistry } from "./registry.js";

describe("platform registry", () => {
  it("matches the PRD table exactly", () => {
    const entries = getProjectPlatformRegistry();
    expect(entries).toHaveLength(29);
    expect(entries.find((item) => item.id === "codex")).toMatchObject({
      id: "codex",
      platformRoot: ".codex",
      skillRoot: ".codex/skills"
    });
    expect(entries.find((item) => item.id === "claude")).toMatchObject({
      id: "claude",
      platformRoot: ".claude",
      skillRoot: ".claude/skills"
    });
    expect(entries.find((item) => item.id === "antigravity")).toMatchObject({
      id: "antigravity",
      platformRoot: ".agents",
      skillRoot: ".agents/skills"
    });
    expect(entries.map((item) => item.id)).toEqual([...entries.map((item) => item.id)].sort());
  });
});
