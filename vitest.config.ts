import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000
  },
  resolve: {
    alias: {
      "@hapergg/harness-comet-schema": new URL("./packages/schema/src/index.ts", import.meta.url).pathname,
      "@hapergg/harness-comet-sdk": new URL("./packages/sdk/src/index.ts", import.meta.url).pathname,
      "@hapergg/harness-comet-core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@hapergg/harness-comet-playwright": new URL(
        "./packages/playwright/src/index.ts",
        import.meta.url
      ).pathname,
      "@hapergg/harness-comet-playwright/reporter": new URL(
        "./packages/playwright/src/reporter.ts",
        import.meta.url
      ).pathname,
      "@hapergg/harness-comet-playwright/list-reporter": new URL(
        "./packages/playwright/src/list-reporter.ts",
        import.meta.url
      ).pathname,
      "@hapergg/harness-comet-adapter-memory": new URL(
        "./packages/adapter-memory/src/index.ts",
        import.meta.url
      ).pathname,
      "@hapergg/harness-comet-adapter-playwright": new URL(
        "./packages/adapter-playwright/src/index.ts",
        import.meta.url
      ).pathname,
      "@hapergg/harness-comet-comet-adapter": new URL(
        "./packages/comet-adapter/src/index.ts",
        import.meta.url
      ).pathname
    }
  }
});
