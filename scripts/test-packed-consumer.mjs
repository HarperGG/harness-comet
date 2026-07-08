#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execa } from "execa";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const artifactDir = path.join(root, "artifacts", "npm");

await ensureTarballs();

const consumerRoot = await fs.mkdtemp(path.join(os.tmpdir(), "harness-comet-consumer-"));
const tarballs = (await fs.readdir(artifactDir))
  .filter((file) => file.endsWith(".tgz"))
  .sort()
  .map((file) => path.join(artifactDir, file));
const tarballByPackage = new Map();
for (const tarball of tarballs) {
  const manifest = await readPackedManifest(tarball);
  tarballByPackage.set(manifest.name, tarball);
}

await fs.writeFile(
  path.join(consumerRoot, "package.json"),
  `${JSON.stringify(
    {
      name: "harness-comet-consumer",
      private: true,
      pnpm: {
        overrides: Object.fromEntries(
          [...tarballByPackage.entries()].map(([name, tarball]) => [
            name,
            `file:${toPosix(tarball)}`
          ])
        )
      }
    },
    null,
    2
  )}\n`,
  "utf8"
);

await run(
  "pnpm",
  ["add", "-D", `file:${toPosix(tarballByPackage.get("@hapergg/harness-comet-cli"))}`],
  consumerRoot
);
await run("pnpm", ["exec", "harness-comet", "--help"], consumerRoot);
const manifestBeforeInit = JSON.parse(
  await fs.readFile(path.join(consumerRoot, "package.json"), "utf8")
);
await run(
  "pnpm",
  [
    "exec",
    "harness-comet",
    "init",
    "--mode",
    "playwright",
    "--test-dir",
    "tests/harness",
    "--skip-browsers",
    "--yes"
  ],
  consumerRoot
);

const generatedManifest = JSON.parse(
  await fs.readFile(path.join(consumerRoot, "package.json"), "utf8")
);
const playwrightSpec = generatedManifest.devDependencies?.["@playwright/test"];
if (!playwrightSpec) {
  throw new Error("Generated manifest is missing @playwright/test");
}
const harnessPlaywrightSpec =
  generatedManifest.devDependencies?.["@hapergg/harness-comet-playwright"];
if (harnessPlaywrightSpec) {
  throw new Error("Plain Playwright init should not add @hapergg/harness-comet-playwright");
}
for (const [name, spec] of Object.entries(generatedManifest.devDependencies ?? {})) {
  if (manifestBeforeInit.devDependencies?.[name] === spec) continue;
  if (typeof spec === "string" && path.isAbsolute(spec.replace(/^file:/, ""))) {
    throw new Error(`Generated manifest contains absolute local path for ${name}: ${spec}`);
  }
}

await fs.stat(path.join(consumerRoot, "playwright.config.ts"));
await fs.stat(path.join(consumerRoot, "tests", "harness", "journeys"));
await fs.stat(path.join(consumerRoot, "tests", "harness", "incidents"));
await fs.stat(path.join(consumerRoot, "tests", "harness", "data"));
await fs.stat(path.join(consumerRoot, "tests", "harness", "support"));
try {
  await fs.stat(path.join(consumerRoot, "harness-comet.config.ts"));
  throw new Error("Plain Playwright init should not create harness-comet.config.ts");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
try {
  await fs.stat(path.join(consumerRoot, "tests", "harness", "fixtures.ts"));
  throw new Error("Plain Playwright init should not create tests/harness/fixtures.ts");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
await run("pnpm", ["exec", "playwright", "test", "--list"], consumerRoot);
console.log(`consumer test passed in ${consumerRoot}`);

async function ensureTarballs() {
  try {
    const tarballs = (await fs.readdir(artifactDir)).filter((file) => file.endsWith(".tgz"));
    if (tarballs.length >= 8) return;
  } catch {
    // Fall through and build tarballs.
  }
  await run("node", ["scripts/pack-all.mjs"], root);
}

async function run(command, args, cwd) {
  await execa(command, args, {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? "0"
    }
  });
}

async function readPackedManifest(tarball) {
  const { stdout } = await execa("tar", ["-xOf", tarball, "package/package.json"]);
  return JSON.parse(stdout);
}

function toPosix(value) {
  return value.split(path.sep).join(path.posix.sep);
}
