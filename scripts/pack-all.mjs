#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { verifyPackedPackage } from "./verify-packed-package.mjs";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const artifactDir = path.join(root, "artifacts", "npm");

const packageOrder = [
  "schema",
  "sdk",
  "core",
  "playwright",
  "adapter-memory",
  "adapter-playwright",
  "comet-adapter",
  "cli"
];

await fs.rm(artifactDir, { recursive: true, force: true });
await fs.mkdir(artifactDir, { recursive: true });

const tarballs = [];
await execa("pnpm", ["clean"], { cwd: root, stdio: "inherit" });
await execa("pnpm", ["build"], { cwd: root, stdio: "inherit" });

for (const packageDir of packageOrder) {
  const cwd = path.join(root, "packages", packageDir);
  const before = new Set(await fs.readdir(artifactDir));
  await execa("pnpm", ["pack", "--pack-destination", artifactDir], {
    cwd,
    stdio: "inherit"
  });
  const after = await fs.readdir(artifactDir);
  const created = after.find((file) => file.endsWith(".tgz") && !before.has(file));
  if (!created) throw new Error(`No tarball produced for packages/${packageDir}`);
  const tarballPath = path.join(artifactDir, created);
  await verifyPackedPackage(tarballPath);
  tarballs.push(tarballPath);
}

console.log(`packed ${tarballs.length} packages into ${path.relative(root, artifactDir)}`);
