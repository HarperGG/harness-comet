import { describe, expect, it } from "vitest";
import {
  cometExecutable,
  formatMissingCometMessage,
  shouldCheckComet
} from "../bin/comet-bootstrap.js";

describe("Comet prerequisite", () => {
  it("uses the Windows command shim when needed", () => {
    expect(cometExecutable("win32")).toBe("comet.cmd");
    expect(cometExecutable("linux")).toBe("comet");
  });

  it("checks commands that require Comet", () => {
    expect(shouldCheckComet(["node", "cli", "setup", "--mode", "playwright"])).toBe(true);
    expect(shouldCheckComet(["node", "cli", "comet", "install"])).toBe(true);
    expect(shouldCheckComet(["node", "cli", "setup", "--dry-run"])).toBe(false);
    expect(shouldCheckComet(["node", "cli", "doctor"])).toBe(false);
  });

  it("prints explicit global installation instructions", () => {
    const message = formatMissingCometMessage();
    expect(message).toContain("Comet CLI is required but was not found.");
    expect(message).toContain("Install Comet globally");
    expect(message).toContain("npm install -g @rpamis/comet");
    expect(message).not.toContain("Install it globally now?");
  });
});
