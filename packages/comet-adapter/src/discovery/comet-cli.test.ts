import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { detectCometCli } from "./comet-cli.js";
import { isSupportedCometVersion } from "../compatibility/version.js";

const original = process.env.HARNESS_COMET_COMET_BIN;

afterEach(() => {
  if (original === undefined) delete process.env.HARNESS_COMET_COMET_BIN;
  else process.env.HARNESS_COMET_COMET_BIN = original;
});

describe("Comet CLI detection", () => {
  it("parses supported and unsupported versions", () => {
    expect(isSupportedCometVersion("0.3.8")).toBe(true);
    expect(isSupportedCometVersion("0.4.0")).toBe(false);
  });

  it("reports missing CLI", async () => {
    process.env.HARNESS_COMET_COMET_BIN = path.join(tmpdir(), "does-not-exist-comet");
    const status = await detectCometCli(process.cwd());
    expect(status.installed).toBe(false);
    expect(status.supported).toBe(false);
  });

  it("parses version output from a fake comet binary", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "fake-comet-"));
    const script = path.join(root, "comet");
    await writeFile(script, "#!/bin/sh\necho 'comet 0.3.8'\n", "utf8");
    await chmod(script, 0o755);
    process.env.HARNESS_COMET_COMET_BIN = script;
    const status = await detectCometCli(root);
    expect(status).toMatchObject({
      installed: true,
      version: "0.3.8",
      supported: true
    });
  });
});
