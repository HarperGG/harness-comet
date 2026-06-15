import fs from "node:fs/promises";
import path from "node:path";

export interface DiscoverPlaywrightHarnessAssetsOptions {
  root: string;
  testDir: string;
  testMatch: string[];
}

export interface PlaywrightHarnessScenarioAsset {
  id: string;
  title: string;
  component: string;
  capability: string;
  behavior: string;
  contract: string;
  kind?: string;
  risk?: string;
  tags?: string[];
}

export interface PlaywrightHarnessTestAsset {
  path: string;
  scenarios: PlaywrightHarnessScenarioAsset[];
}

export interface PlaywrightHarnessAssets {
  tests: PlaywrightHarnessTestAsset[];
}

export async function discoverPlaywrightHarnessAssets(
  options: DiscoverPlaywrightHarnessAssetsOptions
): Promise<PlaywrightHarnessAssets> {
  const root = path.resolve(options.root, options.testDir);
  const files = await walk(root);
  const tests = await Promise.all(
    files
      .filter((file) => isSpecFile(file, options.testMatch))
      .sort()
      .map(async (file) => {
        const source = await fs.readFile(file, "utf8");
        return {
          path: file,
          scenarios: extractScenarioBlocks(source)
            .map(parseScenarioBlock)
            .filter((value): value is PlaywrightHarnessScenarioAsset => value !== null)
        };
      })
  );
  return { tests };
}

async function walk(root: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(root, { withFileTypes: true });
    const files = await Promise.all(
      entries.map(async (entry) => {
        const full = path.join(root, entry.name);
        if (entry.isDirectory()) return walk(full);
        if (entry.isFile()) return [full];
        return [];
      })
    );
    return files.flat();
  } catch {
    return [];
  }
}

function isSpecFile(file: string, testMatch: string[]): boolean {
  if (testMatch.includes("**/*.spec.ts") && file.endsWith(".spec.ts")) return true;
  if (testMatch.includes("**/*.test.ts") && file.endsWith(".test.ts")) return true;
  return file.endsWith(".spec.ts");
}

function extractScenarioBlocks(source: string): string[] {
  const blocks: string[] = [];
  const marker = "defineHarnessScenario(";
  let index = source.indexOf(marker);
  while (index >= 0) {
    const start = source.indexOf("{", index);
    if (start < 0) break;
    let depth = 0;
    for (let cursor = start; cursor < source.length; cursor += 1) {
      const char = source[cursor];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) {
        blocks.push(source.slice(start, cursor + 1));
        break;
      }
    }
    index = source.indexOf(marker, index + marker.length);
  }
  return blocks;
}

function parseScenarioBlock(block: string): PlaywrightHarnessScenarioAsset | null {
  const id = stringField(block, "id");
  const title = stringField(block, "title");
  const component = stringField(block, "component");
  const capability = stringField(block, "capability");
  const behavior = stringField(block, "behavior");
  const contract = stringField(block, "contract");
  if (!id || !title || !component || !capability || !behavior || !contract) return null;
  return {
    id,
    title,
    component,
    capability,
    behavior,
    contract,
    kind: stringField(block, "kind"),
    risk: stringField(block, "risk"),
    tags: stringArrayField(block, "tags")
  };
}

function stringField(block: string, field: string): string | undefined {
  const match = block.match(new RegExp(`${field}\\s*:\\s*["'\`]([^"'\`]+)["'\`]`));
  return match?.[1];
}

function stringArrayField(block: string, field: string): string[] | undefined {
  const match = block.match(new RegExp(`${field}\\s*:\\s*\\[([^\\]]*)\\]`));
  if (!match) return undefined;
  return match[1]
    .split(",")
    .map((item) => item.trim().replace(/^["'`]|["'`]$/g, ""))
    .filter(Boolean);
}
