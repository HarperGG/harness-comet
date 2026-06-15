import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildProgram } from "./index.js";

describe("cli init", () => {
  it("creates memory templates", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "harness-cli-"));
    const program = buildProgram();
    await program.parseAsync([
      "node",
      "harness-comet",
      "--root",
      root,
      "init",
      "--mode",
      "runtime",
      "--adapter",
      "memory",
      "--yes"
    ]);
    await expect(readFile(path.join(root, "harness-comet.config.ts"), "utf8")).resolves.toContain(
      "@harness-comet/adapter-memory"
    );
    await expect(
      readFile(path.join(root, "harness/scenarios/example-smoke.scenario.yaml"), "utf8")
    ).resolves.toContain("memory.set");
  });
});
