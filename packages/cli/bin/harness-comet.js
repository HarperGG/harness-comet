#!/usr/bin/env node
import packageJson from "../package.json" with { type: "json" };
import { runSkillCommand } from "../dist/commands/skill-entry.js";
import { main } from "../dist/index.js";

if (process.argv.length === 3 && ["--version", "-V"].includes(process.argv[2])) {
  process.stdout.write(`${packageJson.version}\n`);
} else {
  runSkillCommand(process.argv)
    .then((handled) => (handled ? undefined : main(process.argv)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 10;
    });
}
