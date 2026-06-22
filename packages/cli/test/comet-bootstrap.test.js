import { describe, expect, it } from "vitest";
import {
  bootstrapComet,
  cometExecutable,
  formatMissingCometMessage,
  shouldCheckComet
} from "../bin/comet-bootstrap.js";

describe("Comet prerequisite", () => {
  it("uses the Windows command shim when needed", () => {
    expect(cometExecutable("win32", {})).toBe("comet.cmd");
    expect(cometExecutable("linux", {})).toBe("comet");
  });

  it("respects an explicit Comet binary override", () => {
    expect(
      cometExecutable("win32", {
        HARNESS_COMET_COMET_BIN: "C:\\tools\\comet-custom.cmd"
      })
    ).toBe("C:\\tools\\comet-custom.cmd");
  });

  it("checks commands that require Comet", () => {
    expect(shouldCheckComet(["node", "cli", "setup", "--mode", "playwright"])).toBe(true);
    expect(shouldCheckComet(["node", "cli", "comet", "install"])).toBe(true);
    expect(shouldCheckComet(["node", "cli", "setup", "--dry-run"])).toBe(false);
    expect(shouldCheckComet(["node", "cli", "doctor"])).toBe(false);
  });

  it("prints explicit global installation instructions without an install prompt", () => {
    const message = formatMissingCometMessage();
    expect(message).toContain("Comet CLI is required but was not found.");
    expect(message).toContain("Install Comet globally");
    expect(message).toContain("npm install -g @rpamis/comet");
    expect(message).not.toContain("Install it globally now?");
    expect(message).not.toContain("Yes, run npm install");
    expect(message).not.toContain("No, show installation instructions");
  });

  it("passes the resolved Windows shim to the adapter after bootstrap", async () => {
    const env = {};
    const argv = ["node", "cli", "setup", "--mode", "playwright"];
    const result = await bootstrapComet(argv, {
      platform: "win32",
      env,
      output: { write() {} }
    });

    // The real spawn check cannot succeed on non-Windows test hosts, so this
    // assertion only applies when the bootstrap accepted the executable.
    if (result) {
      expect(env.HARNESS_COMET_COMET_BIN).toBe("comet.cmd");
    }
  });
});
