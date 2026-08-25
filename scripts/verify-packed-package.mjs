#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execa } from "execa";

const EXPECTED_PREFIX = "@hapergg/harness-comet-";
const NPM_REGISTRY = "https://registry.npmjs.org/";

export async function verifyPackedPackage(tarballPath) {
  const absoluteTarball = path.resolve(tarballPath);
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "harness-comet-pack-"));

  try {
    const localTarballName = "package.tgz";
    await fs.copyFile(absoluteTarball, path.join(tempDir, localTarballName));

    await execa("tar", ["-xzf", localTarballName], {
      cwd: tempDir
    });
    const packageRoot = path.join(tempDir, "package");
    const manifestPath = path.join(packageRoot, "package.json");
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

    assert(
      typeof manifest.name === "string" && manifest.name.startsWith(EXPECTED_PREFIX),
      `${absoluteTarball}: package name must start with ${EXPECTED_PREFIX}`
    );
    assert(
      manifest.publishConfig?.registry === NPM_REGISTRY,
      `${manifest.name}: publishConfig.registry must be ${NPM_REGISTRY}`
    );
    assert(
      manifest.publishConfig?.access === "public",
      `${manifest.name}: publishConfig.access must be public`
    );

    assertNoLocalDependencySpecs(manifest, "dependencies");
    assertNoLocalDependencySpecs(manifest, "peerDependencies");
    assertNoLocalDependencySpecs(manifest, "optionalDependencies");
    assertNoLocalDependencySpecs(manifest, "devDependencies");

    await assertFile(packageRoot, manifest.main, `${manifest.name}: main`);
    await assertFile(packageRoot, manifest.types, `${manifest.name}: types`);
    await assertExports(packageRoot, manifest.exports, manifest.name);
    await assertNoUnwantedFiles(packageRoot, manifest.name);

    if (manifest.name === "@hapergg/harness-comet-cli") {
      const binPath = manifest.bin?.["harness-comet"];

      assert(binPath === "./bin/harness-comet.js", `${manifest.name}: bin path is invalid`);

      const stat = await assertFile(packageRoot, binPath, `${manifest.name}: bin`);

      const binContent = await fs.readFile(
        path.join(packageRoot, binPath.replace(/^\.\//, "")),
        "utf8"
      );

      assert(
        binContent.startsWith("#!/usr/bin/env node"),
        `${manifest.name}: bin is missing node shebang`
      );

      if (process.platform !== "win32") {
        assert((stat.mode & 0o111) !== 0, `${manifest.name}: bin is not executable`);
      }
    }

    return manifest;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function assertExports(packageRoot, exportsValue, packageName) {
  assert(exportsValue && typeof exportsValue === "object", `${packageName}: exports is required`);
  for (const [subpath, target] of Object.entries(exportsValue)) {
    if (typeof target === "string") {
      await assertFile(packageRoot, target, `${packageName} export ${subpath}`);
      continue;
    }
    assert(target && typeof target === "object", `${packageName}: export ${subpath} is invalid`);
    for (const key of ["types", "import", "default"]) {
      if (target[key]) {
        await assertFile(packageRoot, target[key], `${packageName} export ${subpath}.${key}`);
      }
    }
  }
}

async function assertNoUnwantedFiles(packageRoot, packageName) {
  const files = await listFiles(packageRoot);
  for (const file of files) {
    assert(!file.startsWith("src/"), `${packageName}: packed tarball contains ${file}`);
    assert(!file.endsWith(".test.js"), `${packageName}: packed tarball contains ${file}`);
    assert(!file.endsWith(".test.d.ts"), `${packageName}: packed tarball contains ${file}`);
    assert(!file.endsWith(".tsbuildinfo"), `${packageName}: packed tarball contains ${file}`);
  }
}

async function listFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = await listFiles(absolute);
      files.push(...nested.map((file) => path.join(entry.name, file)));
    } else {
      files.push(entry.name);
    }
  }
  return files.map((file) => file.split(path.sep).join("/"));
}

async function assertFile(packageRoot, filePath, label) {
  assert(typeof filePath === "string" && filePath.length > 0, `${label} is missing`);
  const relative = filePath.replace(/^\.\//, "");
  try {
    return await fs.stat(path.join(packageRoot, relative));
  } catch {
    throw new Error(`${label} points to missing file ${filePath}`);
  }
}

function assertNoLocalDependencySpecs(manifest, field) {
  const dependencies = manifest[field];
  if (!dependencies) return;
  for (const [name, spec] of Object.entries(dependencies)) {
    assert(
      typeof spec === "string" && !spec.startsWith("workspace:") && !spec.startsWith("file:"),
      `${manifest.name}: ${field}.${name} uses non-publishable spec ${spec}`
    );
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tarballs = process.argv.slice(2);
  if (tarballs.length === 0) {
    throw new Error("Usage: node scripts/verify-packed-package.mjs <tarball...>");
  }
  for (const tarball of tarballs) {
    const manifest = await verifyPackedPackage(tarball);
    console.log(`verified ${manifest.name}`);
  }
}
