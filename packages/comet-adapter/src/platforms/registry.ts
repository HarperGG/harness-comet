import type { AgentPlatformRecord } from "../types.js";

const registry: AgentPlatformRecord[] = [
  ["amazon-q", "Amazon Q Developer", ".amazonq", ".amazonq/skills"],
  ["antigravity", "Antigravity", ".agents", ".agents/skills"],
  ["auggie", "Auggie", ".augment", ".augment/skills"],
  ["bob", "Bob Shell", ".bob", ".bob/skills"],
  ["claude", "Claude Code", ".claude", ".claude/skills"],
  ["cline", "Cline", ".cline", ".cline/skills"],
  ["codebuddy", "CodeBuddy", ".codebuddy", ".codebuddy/skills"],
  ["codex", "Codex", ".codex", ".codex/skills"],
  ["continue", "Continue", ".continue", ".continue/skills"],
  ["costrict", "CoStrict", ".cospec", ".cospec/skills"],
  ["crush", "Crush", ".crush", ".crush/skills"],
  ["cursor", "Cursor", ".cursor", ".cursor/skills"],
  ["factory", "Factory Droid", ".factory", ".factory/skills"],
  ["forgecode", "ForgeCode", ".forge", ".forge/skills"],
  ["gemini", "Gemini CLI", ".gemini", ".gemini/skills"],
  ["github-copilot", "GitHub Copilot", ".github", ".github/skills"],
  ["iflow", "iFlow", ".iflow", ".iflow/skills"],
  ["junie", "Junie", ".junie", ".junie/skills"],
  ["kilocode", "Kilo Code", ".kilocode", ".kilocode/skills"],
  ["kimicode", "Kimi Code", ".kimi-code", ".kimi-code/skills"],
  ["kiro", "Kiro", ".kiro", ".kiro/skills"],
  ["lingma", "Lingma", ".lingma", ".lingma/skills"],
  ["opencode", "OpenCode", ".opencode", ".opencode/skills"],
  ["pi", "Pi", ".pi", ".pi/skills"],
  ["qoder", "Qoder", ".qoder", ".qoder/skills"],
  ["qwen", "Qwen Code", ".qwen", ".qwen/skills"],
  ["roocode", "RooCode", ".roo", ".roo/skills"],
  ["trae", "Trae", ".trae", ".trae/skills"],
  ["windsurf", "Windsurf", ".windsurf", ".windsurf/skills"]
]
  .map(([id, displayName, platformRoot, skillRoot]) => ({
    id,
    displayName,
    platformRoot,
    skillRoot
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

export function getProjectPlatformRegistry(): AgentPlatformRecord[] {
  return registry;
}
