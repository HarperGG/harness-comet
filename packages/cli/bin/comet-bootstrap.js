import { spawnSync } from "node:child_process";

const COMET_PACKAGE = "@rpamis/comet";
const COMET_INSTALL_COMMAND = `npm install -g ${COMET_PACKAGE}`;

export function cometExecutable(platform = process.platform, env = process.env) {
  if (env.HARNESS_COMET_COMET_BIN) return env.HARNESS_COMET_COMET_BIN;
  return platform === "win32" ? "comet.cmd" : "comet";
}

export function shouldCheckComet(argv) {
  const args = argv.slice(2);
  if (args.includes("--dry-run") || args.includes("--json")) return false;
  if (args[0] === "setup") return true;
  return args[0] === "comet" && args[1] === "install";
}

export function windowsCommandLine(command, args) {
  const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
  const inner = [quote(command), ...args.map(quote)].join(" ");
  // cmd.exe /s /c requires an extra pair of outer quotes when the command
  // itself is quoted. Without them, cmd can strip the executable quotes and
  // fail to resolve npm-generated *.cmd shims such as comet.cmd.
  return `"${inner}"`;
}

function commandSpec(command, args, platform = process.platform, env = process.env) {
  if (platform !== "win32") return { command, args };
  return {
    command: env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", windowsCommandLine(command, args)]
  };
}

export function isCometAvailable(platform = process.platform, env = process.env) {
  const command = cometExecutable(platform, env);
  const spec = commandSpec(command, ["--version"], platform, env);
  const result = spawnSync(spec.command, spec.args, {
    stdio: "ignore",
    shell: false
  });
  return !result.error && result.status === 0;
}

export function formatMissingCometMessage() {
  return [
    "Comet CLI is required but was not found.",
    "",
    "Install Comet globally before running Harness-Comet:",
    "",
    `  ${COMET_INSTALL_COMMAND}`,
    "",
    "Then run the Harness-Comet command again.",
    ""
  ].join("\n");
}

export async function bootstrapComet(argv, options = {}) {
  if (!shouldCheckComet(argv)) return argv;

  const platform = options.platform ?? process.platform;
  const env = options.env ?? process.env;
  if (isCometAvailable(platform, env)) {
    // Keep the adapter and bootstrap checks on the exact same executable,
    // especially on Windows where npm exposes command shims as *.cmd files.
    if (!env.HARNESS_COMET_COMET_BIN) {
      env.HARNESS_COMET_COMET_BIN = cometExecutable(platform, env);
    }
    return argv;
  }

  const output = options.output ?? process.stderr;
  output.write(formatMissingCometMessage());
  process.exitCode = 6;
  return null;
}
