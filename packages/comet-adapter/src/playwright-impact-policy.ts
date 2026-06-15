export const PLAYWRIGHT_DECISIONS = [
  "reuse",
  "update",
  "extend",
  "create",
  "none"
] as const;

export type PlaywrightImpactDecision = (typeof PLAYWRIGHT_DECISIONS)[number];

export const PLAYWRIGHT_CREATE_DECISIONS = new Set<PlaywrightImpactDecision>(["create"]);

export function normalizePlaywrightDecision(value: string): PlaywrightImpactDecision {
  const normalized = value.trim().toLowerCase();
  if (normalized === "reuse") return "reuse";
  if (normalized === "update") return "update";
  if (normalized === "extend") return "extend";
  if (normalized === "create") return "create";
  return "none";
}

export function isDecisionAllowedForMode(
  mode: "full" | "maintain" | "off",
  decision: PlaywrightImpactDecision
): boolean {
  if (mode === "full") {
    return true;
  }
  if (mode === "maintain") {
    return decision !== "create";
  }
  return decision === "none";
}

export function classifyPlaywrightAssetPath(filePath: string): {
  kind: "test-spec" | "test-support" | "config" | "other";
  managed: boolean;
} {
  if (/\.spec\.[cm]?[jt]sx?$/.test(filePath)) {
    return { kind: "test-spec", managed: true };
  }
  if (filePath === "playwright.config.ts") {
    return { kind: "config", managed: true };
  }
  if (/^tests\//.test(filePath)) {
    return { kind: "test-support", managed: true };
  }
  return { kind: "other", managed: false };
}
