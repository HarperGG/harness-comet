import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadHarnessCometConfig } from "./project-config.js";

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "harness-comet-config-"));
}

describe("loadHarnessCometConfig", () => {
  it("loads harness-comet.config.ts", async () => {
    const root = await tempProject();
    await fs.writeFile(
      path.join(root, "harness-comet.config.ts"),
      `export default {
        schemaVersion: 1,
        mode: "playwright",
        playwright: { configFile: "playwright.config.ts", testDir: "tests", testMatch: ["**/*.spec.ts"] }
      };`
    );

    const loaded = await loadHarnessCometConfig({ root });
    expect(loaded.configPath.endsWith("harness-comet.config.ts")).toBe(true);
    expect(loaded.config.mode).toBe("playwright");
  });

  it("does not load harness.config.ts by default", async () => {
    const root = await tempProject();
    await fs.writeFile(
      path.join(root, "harness.config.ts"),
      `export default {
        schemaVersion: 1,
        mode: "runtime",
        adapter: { default: "memory", entries: { memory: "@harness-comet/adapter-memory" } }
      };`
    );

    await expect(loadHarnessCometConfig({ root })).rejects.toThrow("Missing harness-comet.config.ts");
  });

  it("can load an explicitly provided config path", async () => {
    const root = await tempProject();
    await fs.writeFile(
      path.join(root, "custom.config.ts"),
      `export default {
        schemaVersion: 1,
        mode: "runtime",
        adapter: { default: "memory", entries: { memory: "@harness-comet/adapter-memory" } }
      };`
    );

    const loaded = await loadHarnessCometConfig({ root, config: "custom.config.ts" });
    expect(loaded.configPath.endsWith("custom.config.ts")).toBe(true);
    expect(loaded.config.mode).toBe("runtime");
  });
});
