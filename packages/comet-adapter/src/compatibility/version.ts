export const SUPPORTED_COMET_RANGE = ">=0.3.8 <0.4.0";

function parse(version: string): [number, number, number] | undefined {
  const match = version.trim().match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function isSupportedCometVersion(version: string): boolean {
  const parts = parse(version);
  if (!parts) return false;
  const [major, minor, patch] = parts;
  if (major !== 0) return false;
  if (minor < 3) return false;
  if (minor > 3) return false;
  return patch >= 8;
}
