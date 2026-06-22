import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  commandNeedsShell,
  confirmInstall,
  installCometGlobally,
  npmExecutable,
  shouldBootstrapComet
} from "../bin/comet-bootstrap.js";

describe("comet bootstrap", () => {
  it("uses npm.cmd and a shell on Windows", () => {
    expect(npmExecutable("win32")).toBe("npm.cmd");
    expect(commandNeedsShell("win32")).toBe(true);
    expect(npmExecutable("linux")).toBe("npm");
    expect(commandNeedsShell("linux")).toBe(false);
  });

  it("bootstraps setup and comet install commands", () => {
    expect(shouldBootstrapComet(["node", "cli", "setup", "--mode", "playwright"])).toBe(true);
    expect(shouldBootstrapComet(["node", "cli", "comet", "install"])).toBe(true);
    expect(shouldBootstrapComet(["node", "cli", "setup", "--dry-run"])).toBe(false);
    expect(shouldBootstrapComet(["node", "cli", "doctor"])).toBe(false);
  });

  it("spawns npm through the Windows command shell", async () => {
    const child = new EventEmitter();
    const spawnImpl = vi.fn(() => child);
    const pending = installCometGlobally({ cwd: "C:/repo", platform: "win32", spawnImpl });
    child.emit("close", 0, null);
    await pending;

    expect(spawnImpl).toHaveBeenCalledWith(
      "npm.cmd",
      ["install", "-g", "@rpamis/comet"],
      expect.objectContaining({ cwd: "C:/repo", stdio: "inherit", shell: true })
    );
  });

  it("supports arrow-key selection and Enter", async () => {
    const input = Object.assign(new EventEmitter(), {
      isTTY: true,
      setRawMode: vi.fn(),
      resume: vi.fn(),
      pause: vi.fn()
    });
    const output = { isTTY: true, write: vi.fn() };

    const confirmation = confirmInstall({ input, output });
    input.emit("keypress", "", { name: "down" });
    input.emit("keypress", "", { name: "return" });

    await expect(confirmation).resolves.toBe(false);
    expect(input.setRawMode).toHaveBeenNthCalledWith(1, true);
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
  });
});
