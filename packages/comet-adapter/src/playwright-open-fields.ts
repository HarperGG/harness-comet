export const PLAYWRIGHT_OPEN_OPERATIONS = new Set([
  "verify",
  "update",
  "create",
  "retire",
  "ignore"
]);

export function parseQuotedBooleanField(content: string, field: string): boolean | null {
  const match = content.match(
    new RegExp(`\\b${field}:\\s*["']?(true|false)["']?(?:\\s*(?:#.*)?)?$`, "im")
  );
  return match ? match[1].toLowerCase() === "true" : null;
}

export function parseQuotedWordField(content: string, field: string): string | null {
  const match = content.match(
    new RegExp(`\\b${field}:\\s*["']?([a-z-]+)["']?(?:\\s*(?:#.*)?)?$`, "im")
  );
  return match?.[1]?.toLowerCase() ?? null;
}

export function parsePlaywrightOperations(content: string): string[] {
  return [
    ...content.matchAll(
      /^\s*(?:-\s*)?operation:\s*["']?([a-z-]+)["']?(?:\s*(?:#.*)?)?$/gim
    )
  ].map((match) => match[1].toLowerCase());
}
