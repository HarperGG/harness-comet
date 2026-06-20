import path from "node:path";
import { installSkill, listAvailableSkills } from "@hapergg/harness-comet-comet-adapter";

export async function runSkillCommand(argv: string[]): Promise<boolean> {
  const skillIndex = argv.indexOf("skill");
  if (skillIndex === -1) return false;
  const action = argv[skillIndex + 1];
  const json = argv.includes("--json");

  if (action === "list") {
    const skills = await listAvailableSkills();
    process.stdout.write(json ? `${JSON.stringify({ skills }, null, 2)}\n` : `${skills.join("\n")}\n`);
    return true;
  }

  if (action !== "install") throw new Error("Usage: harness-comet skill list | harness-comet skill install <name>");
  const name = argv[skillIndex + 2];
  if (!name || name.startsWith("-")) throw new Error("Skill name is required");

  const report = await installSkill({
    projectRoot: path.resolve(readOption(argv, "--root") ?? process.cwd()),
    name,
    platformIds: readRepeatedOption(argv, "--platform"),
    force: argv.includes("--force"),
    dryRun: argv.includes("--dry-run")
  });

  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return true;
  }
  process.stdout.write(`Installed skill ${report.name}${report.dryRun ? " (dry run)" : ""}\n`);
  for (const target of report.targets) {
    process.stdout.write(`- ${target.platformId}: ${path.join(target.skillRoot, report.name)} (${target.files.length} files)\n`);
  }
  return true;
}

function readOption(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  return index === -1 ? undefined : argv[index + 1];
}

function readRepeatedOption(argv: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === name && argv[index + 1]) values.push(argv[index + 1]);
  }
  return values;
}
