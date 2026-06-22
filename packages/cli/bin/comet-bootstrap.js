import { spawnSync } from "node:child_process";

const COMET_PACKAGE = "@rpamis/comet";
const COMET_INSTALL_COMMAND = `npm install -g ${COMET_PACKAGE}`;

export function cometExecutable(platform = process.platform) {
  return platform === "win32" ? "comet.cmd" : "comet";
}

export function shouldCheckComet(argv) {
  const args = argv.slice(2);
  if (args.includes("--dry-run") || args.includes("--json")) return false;
  if (args[0] === "setup") return true;
  return args[0] === "comet" && args[1] === "install";
}

function commandSpec(command, args, platform = process.platform) {
  if (platform !== "win32") return { command, args };
  return {
    command: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", [command, ...args].join(" ")]
  };
}

export function isCometAvailable(platform = process.platform) {
  const spec = commandSpec(cometExecutable(platform), ["--version"], platform);
  const result = spawnSync(spec.command, spec.args, {
    stdio: "ignore",
    shell: false
  });
  return result.status === 0;
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
  if (!shouldCheckComet(argv) || isCometAvailable(options.platform)) return argv;

  const output = options.output ?? process.stderr;
  output.write(formatMissingCometMessage());
  process.exitCode = 6;
  return null;
}
