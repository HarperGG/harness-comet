import { readFile, writeFile } from "node:fs/promises";

async function patch(file, transform) {
  const current = await readFile(file, "utf8");
  const next = transform(current);
  if (next === current) throw new Error(`No changes applied to ${file}`);
  await writeFile(file, next);
}

await patch("packages/comet-adapter/src/manifest.ts", (text) =>
  text
    .replace(
      'export const HARNESS_COMET_MANIFEST_PATH = path.join(".harness-comet", "manifest.json");',
      'export const HARNESS_COMET_STATE_DIR = path.join(".comet", "harness-comet");\nexport const HARNESS_COMET_MANIFEST_PATH = path.join(HARNESS_COMET_STATE_DIR, "manifest.json");\nexport const LEGACY_HARNESS_COMET_MANIFEST_PATH = path.join(".harness-comet", "manifest.json");'
    )
    .replace(
      '  const manifestPath = path.join(projectRoot, HARNESS_COMET_MANIFEST_PATH);\n  try {\n    const content = await fs.readFile(manifestPath, "utf8");',
      '  const manifestPaths = [\n    path.join(projectRoot, HARNESS_COMET_MANIFEST_PATH),\n    path.join(projectRoot, LEGACY_HARNESS_COMET_MANIFEST_PATH)\n  ];\n  for (const manifestPath of manifestPaths) {\n    try {\n      const content = await fs.readFile(manifestPath, "utf8");'
    )
    .replace(
      '    return JSON.parse(content) as HarnessCometManifestV1;\n  } catch (error) {\n    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;\n    throw error;\n  }\n}',
      '      return JSON.parse(content) as HarnessCometManifestV1;\n    } catch (error) {\n      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;\n    }\n  }\n  return undefined;\n}'
    )
);

await patch("packages/comet-adapter/src/install.ts", (text) =>
  text
    .replace(
      '  HARNESS_COMET_MANIFEST_PATH,',
      '  HARNESS_COMET_MANIFEST_PATH,\n  HARNESS_COMET_STATE_DIR,'
    )
    .replace(
      '            ".harness-comet",\n            "backups",',
      '            HARNESS_COMET_STATE_DIR,\n            "backups",'
    )
);

await patch("test/comet-install.integration.test.ts", (text) =>
  text
    .replaceAll('path.join(root, ".harness-comet", "manifest.json")', 'path.join(root, ".comet", "harness-comet", "manifest.json")')
    .replace(
      '    expect(manifest.targets[0].language).toBe("en");',
      '    expect(manifest.targets[0].language).toBe("en");\n    await expect(access(path.join(root, ".harness-comet"))).rejects.toThrow();'
    )
);

await patch("test/comet-uninstall.integration.test.ts", (text) =>
  text.replaceAll('path.join(root, ".harness-comet", "manifest.json")', 'path.join(root, ".comet", "harness-comet", "manifest.json")')
);
