import path from "node:path";
import type { Command } from "commander";
import { installSkill, listAvailableSkills } from "@hapergg/harness-comet-comet-adapter";

interface GlobalOptions { root?: string; json?: boolean }

type Wrap = (action: (...args: any[]) => Promise<void>) => (...args: any[]) => Promise<void>;

export function registerSkillCommands(program: Command, wrap: Wrap, getOptions: () => GlobalOptions): void {
  const skill = program.command("skill").description("List and install Harness Comet skills");
  skill.command("list").action(wrap(async () => {
    const names = await listAvailableSkills();
    process.stdout.write(getOptions().json ? `${JSON.stringify({ skills: names }, null, 2)}\n` : `${names.join("\n")}\n`);
  }));

  skill.command("install")
    .argument("<name>")
    .option("--platform <id>", "target one agent platform; repeat to target several", collect, [])
    .option("--force")
    .option("--dry-run")
    .action(wrap(async (name: string, commandOptions: { platform: string[]; force?: boolean; dryRun?: boolean }) => {
      const global = getOptions();
      const report = await installSkill({
        projectRoot: path.resolve(global.root ?? process.cwd()),
        name,
        platformIds: commandOptions.platform,
        force: commandOptions.force,
        dryRun: commandOptions.dryRun
      });
      if (global.json) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
        return;
      }
      process.stdout.write(`Installed skill ${report.name}${report.dryRun ? " (dry run)" : ""}\n`);
      for (const target of report.targets) {
        process.stdout.write(`- ${target.platformId}: ${path.join(target.skillRoot, report.name)} (${target.files.length} files)\n`);
      }
    }));
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}
