#!/usr/bin/env node
import packageJson from "../package.json" with { type: "json" };
import { runSkillCommand } from "../dist/commands/skill-entry.js";
import { main } from "../dist/index.js";
import { bootstrapComet } from "./comet-bootstrap.js";

if (process.argv.length === 3 && ["--version", "-V"].includes(process.argv[2])) {
  process.stdout.write(`${packageJson.version}\n`);
} else {
  bootstrapComet(process.argv)
    .then((argv) =>
      argv ? runSkillCommand(argv).then((handled) => (handled ? undefined : main(argv))) : undefined
    )
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 10;
    });
}
