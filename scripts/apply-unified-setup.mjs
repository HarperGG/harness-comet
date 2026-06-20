import { readFile, writeFile } from "node:fs/promises";

const cometPath = "packages/cli/src/commands/comet.ts";
let comet = await readFile(cometPath, "utf8");
const anchor = '  const comet = program.command("comet").description("Optional Comet integration commands");\n';
const block = `  program
    .command("setup")
    .description("Initialize Harness and Comet integration for all detected local platforms")
    .requiredOption("--mode <runtime|playwright>", "project mode")
    .option("--test-dir <path>", "Playwright test directory", "tests")
    .option("--skip-install", "write Harness files without running dependency install")
    .option("--skip-browsers", "skip Playwright browser installation")
    .option("--yes", "accept non-interactive defaults")
    .option("--dry-run", "show the write plan without changing files")
    .option(
      "--force",
      "overwrite files already managed by harness-comet or files explicitly allowed by the installer"
    )
    .action(
      withErrors(async (commandOptions) => {
        const options = getOptions();
        const root = options.root ?? process.cwd();
        const mode = commandOptions.mode as "runtime" | "playwright";
        const setupOptions = {
          ...commandOptions,
          allDetected: true,
          initHarness: true,
          adapter: mode === "playwright" ? "playwright" : "memory",
          installBrowsers: false
        };

        if (!options.json && !commandOptions.dryRun) {
          const shouldContinue = await ensureCometCliForInstall(root, setupOptions);
          if (!shouldContinue) return;
        }

        const report = await installComet(root, setupOptions);
        const harness = await maybeInitHarness(root, setupOptions);
        if (mode === "playwright" && !commandOptions.skipBrowsers && !commandOptions.dryRun) {
          const command = await installPlaywrightBrowsers(root);
          harness.browsers = { requested: true, installed: true, command };
        }
        if (options.json) {
          process.stdout.write(JSON.stringify({ ...report, harness }, null, 2) + "\\n");
          return;
        }
        process.stdout.write(formatInstallReport(report, harness));
        process.exitCode = report.comet.installed && report.comet.supported ? 0 : 6;
      })
    );

`;
if (!comet.includes('.command("setup")')) {
  if (!comet.includes(anchor)) throw new Error("Comet command anchor missing");
  comet = comet.replace(anchor, block + anchor);
} else {
  comet = comet.replace(
    '          installBrowsers: mode === "playwright" && !commandOptions.skipBrowsers\n',
    '          installBrowsers: false\n'
  );
  const old = '        const harness = await maybeInitHarness(root, setupOptions);\n        if (options.json) {';
  const replacement = '        const harness = await maybeInitHarness(root, setupOptions);\n        if (mode === "playwright" && !commandOptions.skipBrowsers && !commandOptions.dryRun) {\n          const command = await installPlaywrightBrowsers(root);\n          harness.browsers = { requested: true, installed: true, command };\n        }\n        if (options.json) {';
  if (comet.includes(old)) comet = comet.replace(old, replacement);
}
await writeFile(cometPath, comet);

const readmePath = "README.md";
let readme = await readFile(readmePath, "utf8");
const oldQuickStart = `在业务项目中初始化 Playwright 模式：

\`\`\`bash
pnpm exec harness-comet init \\
  --mode playwright \\
  --test-dir tests \\
  --yes
\`\`\`
`;
const newQuickStart = `在业务项目根目录一键初始化 Playwright Harness 和 Comet 接入：

\`\`\`bash
pnpm exec harness-comet setup --mode playwright
\`\`\`

该命令会自动检测当前项目中的本地 agent 平台，并同时完成：

- 初始化 Playwright Harness；
- 检查或安装 Comet CLI；
- 初始化 Comet 项目；
- 安装 Harness/Playwright 版 Comet skills；
- 安装 Playwright 依赖和 Chromium；
- 为所有检测到的项目本地平台写入接入文件。

用于 CI 或非交互环境：

\`\`\`bash
pnpm exec harness-comet setup --mode playwright --yes
\`\`\`
`;
if (readme.includes(oldQuickStart)) readme = readme.replace(oldQuickStart, newQuickStart);

const oldComet = `### 首次接入

推荐直接运行交互式安装：

\`\`\`bash
pnpm exec harness-comet comet install
\`\`\`
`;
const newComet = `### 首次接入

推荐使用统一初始化命令，不需要指定 agent 平台：

\`\`\`bash
pnpm exec harness-comet setup --mode playwright
\`\`\`

该命令会自动检测并接入所有项目本地平台。只需要安装、修复或重新同步 Comet 接入时，再使用底层命令：

\`\`\`bash
pnpm exec harness-comet comet install
\`\`\`
`;
if (readme.includes(oldComet)) readme = readme.replace(oldComet, newComet);
await writeFile(readmePath, readme);
