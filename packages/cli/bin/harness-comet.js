#!/usr/bin/env node
import packageJson from "../package.json" with { type: "json" };
import { runSkillCommand } from "../dist/commands/skill-entry.js";
import { main } from "../dist/index.js";
import { bootstrapComet } from "./comet-bootstrap.js";

function withAutomaticCometInstall(argv) {
  const args = argv.slice(2);
  const isSetup = args[0] === "setup";
  const isCometInstall = args[0] === "comet" && args[1] === "install";
  if ((!isSetup && !isCometInstall) || args.includes("--yes")) return argv;
  return [...argv, "--yes"];
}

if (process.argv.length === 3 && ["--version", "-V"].includes(process.argv[2])) {
  process.stdout.write(`${packageJson.version}\n`);
} else {
  const argv = withAutomaticCometInstall(process.argv);
  bootstrapComet(argv)
    .then((nextArgv) =>
      nextArgv
        ? runSkillCommand(nextArgv).then((handled) => (handled ? undefined : main(nextArgv)))
        : undefined
    )
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 10;
    });
}
