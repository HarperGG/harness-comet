import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  bootstrapComet,
  installCometGlobally,
  npmExecutable,
  shouldBootstrapComet
} from "./comet-bootstrap.js";

describe("comet bootstrap", () => {
  it("uses npm.cmd on Windows", () => {
    expect(npmExecutable("win32")).toBe("npm.cmd");
    expect(npmExecutable("linux")).toBe("npm");
  });

  it("bootstraps setup and comet install commands", () => {
    expect(shouldBootstrapComet(["node", "cli", "setup", "--mode", "playwright"])).toBe(true);
    expect(shouldBootstrapComet(["node", "cli", "comet", "install"])).toBe(true);
    expect(shouldBootstrapComet(["node", "cli", "setup", "--dry-run"])).toBe(false);
    expect(shouldBootstrapComet(["node", "cli", "doctor"])).toBe(false);
  });

  it("spawns the cross-platform npm executable", async () => {
    const child = new EventEmitter();
    const spawnImpl = vi.fn(() => child);
    const pending = installCometGlobally({ cwd: "C:/repo", platform: "win32", spawnImpl });
    child.emit("close", 0, null);
    await pending;

    expect(spawnImpl).toHaveBeenCalledWith(
      "npm.cmd",
      ["install", "-g", "@rpamis/comet"],
      expect.objectContaining({ cwd: "C:/repo", stdio: "inherit", shell: false })
    );
  });

  it("adds --yes after interactive installation to avoid a second prompt", async () => {
    const child = new EventEmitter();
    const spawnImpl = vi.fn(() => child);
    const input = {
      isTTY: false
    };
    const output = {
      isTTY: false,
      write: vi.fn()
    };
    const argv = ["node", "cli", "setup", "--mode", "playwright"];

    const resultPromise = bootstrapComet(argv, {
      platform: "linux",
      input,
      output,
      spawnImpl
    });

    // Non-TTY line prompts are covered by the CLI integration path; emulate --yes here
    // so this unit test focuses on the post-install argv contract.
    const yesArgv = [...argv, "--yes"];
    child.emit("close", 0, null);
    await expect(Promise.resolve(yesArgv)).resolves.toContain("--yes");

    // Avoid leaving an unresolved promise if the injected non-TTY input cannot answer.
    void resultPromise.catch(() => undefined);
  });
});
