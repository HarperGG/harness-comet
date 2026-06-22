import { describe, expect, it } from "vitest";
import {
  cometExecutable,
  formatMissingCometMessage,
  shouldCheckComet,
  windowsCommandLine
} from "../bin/comet-bootstrap.js";

describe("Comet prerequisite", () => {
  it("uses the Windows command shim when needed", () => {
    expect(cometExecutable("win32", {})).toBe("comet.cmd");
    expect(cometExecutable("linux", {})).toBe("comet");
  });

  it("respects an explicit Comet binary override", () => {
    expect(
      cometExecutable("win32", {
        HARNESS_COMET_COMET_BIN: "C:\\Program Files\\Comet\\comet.cmd"
      })
    ).toBe("C:\\Program Files\\Comet\\comet.cmd");
  });

  it("wraps quoted Windows commands for cmd.exe /s /c", () => {
    expect(windowsCommandLine("comet.cmd", ["--version"])).toBe(
      '\"\"comet.cmd\" \"--version\"\"'
    );
    expect(windowsCommandLine("C:\\Program Files\\Comet\\comet.cmd", ["--version"])).toBe(
      '\"\"C:\\Program Files\\Comet\\comet.cmd\" \"--version\"\"'
    );
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
});
