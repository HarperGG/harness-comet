import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import readline from "node:readline";

const COMET_PACKAGE = "@rpamis/comet";

export function npmExecutable(platform = process.platform) {
  return platform === "win32" ? "npm.cmd" : "npm";
}

export function cometExecutable(platform = process.platform) {
  return platform === "win32" ? "comet.cmd" : "comet";
}

export function shouldBootstrapComet(argv) {
  const args = argv.slice(2);
  if (args.includes("--dry-run") || args.includes("--json")) return false;
  if (args[0] === "setup") return true;
  return args[0] === "comet" && args[1] === "install";
}

function commandSpec(command, args, platform = process.platform) {
  if (platform !== "win32") return { command, args };
  const comspec = process.env.ComSpec || "cmd.exe";
  return { command: comspec, args: ["/d", "/s", "/c", [command, ...args].join(" ")] };
}

export function isCometAvailable(platform = process.platform) {
  const spec = commandSpec(cometExecutable(platform), ["--version"], platform);
  const result = spawnSync(spec.command, spec.args, { stdio: "ignore", shell: false });
  return result.status === 0;
}

export function resolveGlobalCometBinary(platform = process.platform) {
  const spec = commandSpec(npmExecutable(platform), ["prefix", "-g"], platform);
  const result = spawnSync(spec.command, spec.args, {
    encoding: "utf8",
    shell: false
  });
  if (result.status !== 0) return undefined;
  const prefix = result.stdout.trim();
  if (!prefix) return undefined;
  return platform === "win32"
    ? path.join(prefix, "comet.cmd")
    : path.join(prefix, "bin", "comet");
}

export async function installCometGlobally({
  cwd = process.cwd(),
  platform = process.platform,
  spawnImpl = spawn
} = {}) {
  await new Promise((resolve, reject) => {
    const spec = commandSpec(npmExecutable(platform), ["install", "-g", COMET_PACKAGE], platform);
    const child = spawnImpl(spec.command, spec.args, {
      cwd,
      stdio: "inherit",
      shell: false
    });

    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(signal ? `npm install terminated by ${signal}` : `npm install exited with code ${code ?? "unknown"}`));
    });
  });
}

export async function confirmInstall({ input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") {
    return await confirmInstallLine(input, output);
  }

  readline.emitKeypressEvents(input);
  const choices = [
    "Yes, run npm install -g @rpamis/comet",
    "No, show installation instructions"
  ];
  let selected = 0;

  const render = () => {
    output.write("\x1b[2K\r");
    output.write(`${selected === 0 ? "›" : " "} ${choices[0]}\n`);
    output.write("\x1b[2K\r");
    output.write(`${selected === 1 ? "›" : " "} ${choices[1]}`);
    output.write("\x1b[1A\r");
  };

  output.write("Install it globally now?\n\n");
  render();
  input.setRawMode(true);
  input.resume();

  return await new Promise((resolve, reject) => {
    const cleanup = () => {
      input.off("keypress", onKeypress);
      input.setRawMode(false);
      input.pause();
      output.write("\x1b[1B\r\x1b[2K\n");
    };
    const finish = (value) => {
      cleanup();
      resolve(value);
    };
    const onKeypress = (str, key = {}) => {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Installation cancelled"));
        return;
      }
      if (key.name === "up" || key.name === "down") {
        selected = selected === 0 ? 1 : 0;
        render();
        return;
      }
      if (key.name === "return") {
        finish(selected === 0);
        return;
      }
      if (str?.toLowerCase() === "y") finish(true);
      if (str?.toLowerCase() === "n") finish(false);
    };
    input.on("keypress", onKeypress);
  });
}

async function confirmInstallLine(input, output) {
  output.write("Install @rpamis/comet globally now? (Y/n) ");
  const rl = readline.createInterface({ input, output });
  try {
    const answer = await new Promise((resolve) => rl.question("", resolve));
    const normalized = answer.trim().toLowerCase();
    return normalized === "" || normalized === "y" || normalized === "yes";
  } finally {
    rl.close();
  }
}

export async function bootstrapComet(argv, options = {}) {
  if (!shouldBootstrapComet(argv) || isCometAvailable(options.platform)) return argv;

  const output = options.output ?? process.stdout;
  output.write("Comet CLI was not found. Installing @rpamis/comet globally...\n");
  await installCometGlobally(options);

  const binary = resolveGlobalCometBinary(options.platform);
  if (binary) process.env.HARNESS_COMET_COMET_BIN = binary;

  return argv;
}
