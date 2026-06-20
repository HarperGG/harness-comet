import { createRequire } from "node:module";

interface PackageMetadata {
  version: string;
}

const require = createRequire(import.meta.url);
const packageMetadata = require("../package.json") as PackageMetadata;

export const HARNESS_COMET_VERSION = packageMetadata.version;

export const HARNESS_COMET_ADAPTER_MEMORY_PACKAGE =
  "@hapergg/harness-comet-adapter-memory";
export const HARNESS_COMET_ADAPTER_PLAYWRIGHT_PACKAGE =
  "@hapergg/harness-comet-adapter-playwright";
export const HARNESS_COMET_PLAYWRIGHT_PACKAGE = "@hapergg/harness-comet-playwright";
export const HARNESS_COMET_PLAYWRIGHT_DEPENDENCY = `^${HARNESS_COMET_VERSION}`;
