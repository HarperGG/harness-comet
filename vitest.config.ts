import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "test/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000
  },
  resolve: {
    alias: {
      "@harness-comet/schema": new URL("./packages/schema/src/index.ts", import.meta.url).pathname,
      "@harness-comet/sdk": new URL("./packages/sdk/src/index.ts", import.meta.url).pathname,
      "@harness-comet/core": new URL("./packages/core/src/index.ts", import.meta.url).pathname,
      "@harness-comet/adapter-memory": new URL(
        "./packages/adapter-memory/src/index.ts",
        import.meta.url
      ).pathname,
      "@harness-comet/adapter-playwright": new URL(
        "./packages/adapter-playwright/src/index.ts",
        import.meta.url
      ).pathname
    }
  }
});
