import { runSkillCommand } from "./commands/skill-entry.js";
import { main } from "./index.js";

runSkillCommand(process.argv)
  .then((handled) => (handled ? undefined : main(process.argv)))
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 10;
  });
