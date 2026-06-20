import { access, chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execa } from "execa";
import { REQUIRED_SKILL_ROOT_FILES } from "../packages/comet-adapter/src/compatibility/file-contract.js";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];
const originalBin = process.env.HARNESS_COMET_COMET_BIN;
const originalBrowserInstallBin = process.env.HARNESS_COMET_PLAYWRIGHT_INSTALL_BIN;

afterEach(() => {
  if (originalBin === undefined) delete process.env.HARNESS_COMET_COMET_BIN;
  else process.env.HARNESS_COMET_COMET_BIN = originalBin;
  if (originalBrowserInstallBin === undefined) delete process.env.HARNESS_COMET_PLAYWRIGHT_INSTALL_BIN;
  else process.env.HARNESS_COMET_PLAYWRIGHT_INSTALL_BIN = originalBrowserInstallBin;
});

async function createFakeComet(
  version = "0.3.8",
  options: { omitMainSkill?: boolean; language?: "en" | "zh" } = {}
): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "fake-comet-bin-"));
  const script = path.join(root, "comet");
  await writeFile(
    script,
    `#!/bin/sh
set -eu
if [ "\${1:-}" = "--version" ]; then
  echo 'comet ${version}'
  exit 0
fi
if [ "\${1:-}" = "init" ]; then
  project_root="\${@: -1}"
  mkdir -p "$project_root/.codex/skills/comet-open" "$project_root/.codex/skills/comet-design" "$project_root/.codex/skills/comet-build" "$project_root/.codex/skills/comet-verify" "$project_root/.codex/skills/comet-archive" "$project_root/.codex/skills/comet/scripts"
  if [ "${options.language === "zh" ? "1" : "0"}" = "1" ]; then
    printf '# comet-open\\n\\nComet 阶段 1：开启。\\n' > "$project_root/.codex/skills/comet-open/SKILL.md"
    printf '# comet-design\\n\\nComet 阶段 2：深度设计。\\n' > "$project_root/.codex/skills/comet-design/SKILL.md"
    printf '# comet-build\\n\\nComet 阶段 3：构建。\\n' > "$project_root/.codex/skills/comet-build/SKILL.md"
    printf '# comet-verify\\n\\nComet 阶段 4：验证。\\n' > "$project_root/.codex/skills/comet-verify/SKILL.md"
    printf '# comet-archive\\n\\nComet 阶段 5：归档。\\n' > "$project_root/.codex/skills/comet-archive/SKILL.md"
  else
    printf '# comet-open\\n\\nOpen phase from upstream Comet.\\n' > "$project_root/.codex/skills/comet-open/SKILL.md"
    printf '# comet-design\\n\\nDesign phase from upstream Comet.\\n' > "$project_root/.codex/skills/comet-design/SKILL.md"
    printf '# comet-build\\n\\nBuild phase from upstream Comet.\\n' > "$project_root/.codex/skills/comet-build/SKILL.md"
    printf '# comet-verify\\n\\nVerify phase from upstream Comet.\\n' > "$project_root/.codex/skills/comet-verify/SKILL.md"
    printf '# comet-archive\\n\\nArchive phase from upstream Comet.\\n' > "$project_root/.codex/skills/comet-archive/SKILL.md"
  fi
  if [ "${options.omitMainSkill ? "1" : "0"}" != "1" ]; then
    printf '# comet\\n\\nMain Comet skill.\\n' > "$project_root/.codex/skills/comet/SKILL.md"
  fi
  printf '#!/bin/sh\\n' > "$project_root/.codex/skills/comet/scripts/comet-state.sh"
  printf '#!/bin/sh\\n' > "$project_root/.codex/skills/comet/scripts/comet-guard.sh"
  printf '#!/bin/sh\\n' > "$project_root/.codex/skills/comet/scripts/comet-archive.sh"
  chmod +x "$project_root/.codex/skills/comet/scripts/"*.sh
  printf '%s\\n' "$*" > "$project_root/comet-init-args.txt"
  exit 0
fi
echo "unsupported fake comet command: $*" >&2
exit 1
`,
    "utf8"
  );
  await chmod(script, 0o755);
  return script;
}

async function createFakeBrowserInstaller(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "fake-playwright-install-"));
  const script = path.join(root, "install-browsers");
  await writeFile(
    script,
    `#!/bin/sh
set -eu
project_root="$1"
printf 'chromium\\n' > "$project_root/playwright-browser-installed.txt"
exit 0
`,
    "utf8"
  );
  await chmod(script, 0o755);
  return script;
}

async function createFakeGlobalCometInstaller(sourceComet: string): Promise<{
  binDir: string;
  cometPath: string;
  logPath: string;
}> {
  const binDir = await mkdtemp(path.join(tmpdir(), "fake-global-comet-install-"));
  const cometPath = path.join(binDir, "comet");
  const logPath = path.join(binDir, "npm-args.txt");
  const npmPath = path.join(binDir, "npm");
  await writeFile(
    npmPath,
    `#!/bin/sh
set -eu
printf '%s\\n' "$*" > ${shellQuote(logPath)}
if [ "\${1:-}" != "install" ] || [ "\${2:-}" != "-g" ] || [ "\${3:-}" != "@rpamis/comet" ]; then
  echo "unexpected npm args: $*" >&2
  exit 1
fi
cp ${shellQuote(sourceComet)} ${shellQuote(cometPath)}
chmod +x ${shellQuote(cometPath)}
exit 0
`,
    "utf8"
  );
  await chmod(npmPath, 0o755);
  return { binDir, cometPath, logPath };
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

describe("comet install integration", () => {
  it("requires an explicit target selection in non-interactive mode", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-selection-"));
    await mkdir(path.join(root, ".codex"), { recursive: true });

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "install", "--yes"],
      { reject: false }
    );

    expect(result.exitCode).toBe(2);
    expect(result.stderr).toContain("Specify --platform or --all-detected");
  });

  it("prompts to install the missing Comet CLI and continues after confirmation", async () => {
    const installedComet = await createFakeComet("0.3.8");
    const fakeInstall = await createFakeGlobalCometInstaller(installedComet);
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-missing-cli-"));
    const env = {
      ...process.env,
      HARNESS_COMET_COMET_BIN: fakeInstall.cometPath,
      PATH: `${fakeInstall.binDir}${path.delimiter}${process.env.PATH ?? ""}`
    };

    const install = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "install", "--platform", "codex"],
      {
        env,
        input: "yes\n"
      }
    );

    expect(install.exitCode).toBe(0);
    expect(install.stdout).toContain("Comet CLI was not found.");
    expect(install.stdout).toContain("@rpamis/comet >=0.3.8 <0.4.0");
    expect(install.stdout).toContain("Yes, run npm install -g @rpamis/comet");
    expect(install.stdout).toContain("TARGET codex writes=5");
    await expect(readFile(fakeInstall.logPath, "utf8")).resolves.toBe("install -g @rpamis/comet\n");
  });

  it("shows manual installation instructions when the missing Comet CLI prompt is declined", async () => {
    const missingRoot = await mkdtemp(path.join(tmpdir(), "missing-comet-bin-"));
    process.env.HARNESS_COMET_COMET_BIN = path.join(missingRoot, "comet");
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-decline-cli-"));

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "comet", "install", "--platform", "codex"],
      {
        input: "no\n",
        reject: false
      }
    );

    expect(result.exitCode).toBe(6);
    expect(result.stdout).toContain("Comet CLI was not found.");
    expect(result.stdout).toContain("No, show installation instructions");
    expect(result.stdout).toContain("Install Comet CLI with:");
    expect(result.stdout).toContain("npm install -g @rpamis/comet");
    expect(result.stdout).not.toContain("TARGET codex");
  });

  it("supports dry-run without writing managed files", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-dry-run-"));
    await mkdir(path.join(root, ".codex"), { recursive: true });

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--dry-run",
      "--yes"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("DRY_RUN true");
    expect(result.stdout).toContain("TARGET codex");
    await expect(access(path.join(root, ".comet", "harness-comet", "manifest.json"))).rejects.toThrow();
    await expect(access(path.join(root, ".codex", "skills", "comet", "SKILL.md"))).rejects.toThrow();
  });

  it("delegates initialization to Comet, patches existing skills, and writes a manifest", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-write-"));
    await mkdir(path.join(root, ".codex"), { recursive: true });

    const install = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--yes"
    ]);

    expect(install.exitCode).toBe(0);
    expect(install.stdout).toContain("DRY_RUN false");
    expect(install.stdout).toContain("TARGET codex writes=5");

    const initArgs = await readFile(path.join(root, "comet-init-args.txt"), "utf8");
    expect(initArgs).toContain("init --scope project --yes");

    for (const relativePath of REQUIRED_SKILL_ROOT_FILES) {
      const fullPath = path.join(root, ".codex", "skills", relativePath);
      const info = await stat(fullPath);
      expect(info.isFile()).toBe(true);
    }

    const openSkill = await readFile(path.join(root, ".codex", "skills", "comet-open", "SKILL.md"), "utf8");
    expect(openSkill).toContain("Open phase from upstream Comet.");
    expect(openSkill).toContain("<!-- harness-comet:start phase=open version=2 -->");
    expect(openSkill).toContain("harness-comet comet hook open --change");
    expect(openSkill).toContain("## Harness Impact");
    expect(openSkill).toContain("Mode: full | maintain | off");
    expect(openSkill).toContain("Asset decisions:");

    const verifySkill = await readFile(path.join(root, ".codex", "skills", "comet-verify", "SKILL.md"), "utf8");
    expect(verifySkill).toContain("Verify phase from upstream Comet.");
    expect(verifySkill).toContain("harness-comet comet verify --change");
    expect(verifySkill).not.toContain("comet hook verify");

    const designSkill = await readFile(path.join(root, ".codex", "skills", "comet-design", "SKILL.md"), "utf8");
    expect(designSkill).toContain("## Harness Design");

    const archiveSkill = await readFile(path.join(root, ".codex", "skills", "comet-archive", "SKILL.md"), "utf8");
    expect(archiveSkill).toContain("harness-comet comet archive-check --change");
    expect(archiveSkill).not.toContain("comet hook archive");

    const manifestPath = path.join(root, ".comet", "harness-comet", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    expect(manifest).toMatchObject({
      schemaVersion: 1,
      targets: [
        {
          platformId: "codex",
          skillRoot: path.join(root, ".codex", "skills")
        }
      ]
    });
    expect(manifest.targets[0].managedFiles).toHaveLength(5);
    expect(manifest.targets[0].language).toBe("en");
    await expect(access(path.join(root, ".harness-comet"))).rejects.toThrow();

    const doctor = await execa("pnpm", [...cli, "--root", root, "comet", "doctor"]);
    expect(doctor.stdout).toContain("TARGET codex valid=true");
  });

  it("patches phase skills even when Comet init did not create the main comet skill", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8", {
      omitMainSkill: true
    });
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-phase-only-"));

    const install = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--yes"
    ]);

    expect(install.exitCode).toBe(0);
    expect(install.stdout).toContain("TARGET codex writes=5");
    const openSkill = await readFile(path.join(root, ".codex", "skills", "comet-open", "SKILL.md"), "utf8");
    expect(openSkill).toContain("harness-comet:start phase=open");
  });

  it("patches Chinese Comet skills with Chinese Harness instructions and records language", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8", {
      language: "zh"
    });
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-zh-"));

    const install = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--yes"
    ]);

    expect(install.exitCode).toBe(0);
    const openSkill = await readFile(path.join(root, ".codex", "skills", "comet-open", "SKILL.md"), "utf8");
    expect(openSkill).toContain("## Harness 影响分析");
    expect(openSkill).toContain("Mode: full | maintain | off");
    expect(openSkill).toContain("Asset decisions:");
    expect(openSkill).toContain("运行确定性的 open 阶段检查");
    const designSkill = await readFile(path.join(root, ".codex", "skills", "comet-design", "SKILL.md"), "utf8");
    expect(designSkill).toContain("## Harness 设计");
    const manifest = JSON.parse(await readFile(path.join(root, ".comet", "harness-comet", "manifest.json"), "utf8"));
    expect(manifest.targets[0].language).toBe("zh");
  });

  it("prints a Harness init hint when Comet install completes without Harness assets", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-harness-hint-"));

    const install = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--yes"
    ]);

    expect(install.exitCode).toBe(0);
    expect(install.stdout).toContain("HARNESS requested=false initialized=false adapter=-");
    expect(install.stdout).toContain("HINT Harness is not initialized");
    await expect(access(path.join(root, "harness-comet.config.ts"))).rejects.toThrow();
  });

  it("can initialize Harness assets after Comet install when requested", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    process.env.HARNESS_COMET_PLAYWRIGHT_INSTALL_BIN = await createFakeBrowserInstaller();
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-init-harness-"));

    const install = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--yes",
      "--init-harness",
      "--adapter",
      "playwright",
      "--install-browsers"
    ]);

    expect(install.exitCode).toBe(0);
    expect(install.stdout).toContain("HARNESS requested=true initialized=true adapter=playwright");
    expect(install.stdout).toContain("BROWSERS requested=true installed=true");
    const config = await readFile(path.join(root, "harness-comet.config.ts"), "utf8");
    expect(config).toContain('default: "playwright"');
    const scenario = await readFile(path.join(root, "harness", "scenarios", "example-smoke.scenario.yaml"), "utf8");
    expect(scenario).toContain("adapter: playwright");
    await expect(readFile(path.join(root, "playwright-browser-installed.txt"), "utf8")).resolves.toBe(
      "chromium\n"
    );
  });

  it("replaces Comet skills and installs Playwright authoring skills when mode=playwright", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-playwright-mode-"));

    const install = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--yes",
      "--init-harness",
      "--mode",
      "playwright",
      "--skip-install",
      "--skip-browsers"
    ]);

    expect(install.exitCode).toBe(0);

    const skillRoot = path.join(root, ".codex", "skills");

    const openSkill = await readFile(
      path.join(skillRoot, "comet-open", "SKILL.md"),
      "utf8"
    );

    expect(openSkill).toContain("### Harness/Playwright Impact Analysis");
    expect(openSkill).toContain("playwright-impact-analysis");
    expect(openSkill).toContain("playwright-authoring-decision");
    expect(openSkill).toContain(
      "verify`, `update`, `create`, `retire`, or `ignore"
    );
    expect(openSkill).toContain("harness-comet comet hook open --change");

    expect(openSkill).not.toContain("harness-comet impact set");
    expect(openSkill).not.toContain("verify-existing");
    expect(openSkill).not.toContain("update-or-create");

    const designSkill = await readFile(
      path.join(skillRoot, "comet-design", "SKILL.md"),
      "utf8"
    );

    expect(designSkill).toContain("### Harness/Playwright Authoring Plan");
    expect(designSkill).toContain("playwright-authoring-plan");
    expect(designSkill).toContain("harness-comet comet hook design --change");

    const buildSkill = await readFile(
      path.join(skillRoot, "comet-build", "SKILL.md"),
      "utf8"
    );

    expect(buildSkill).toContain("playwright-authoring-build");
    expect(buildSkill).toContain("playwright-authoring-verify");
    expect(buildSkill).toContain("harness-comet comet hook build --change");

    const verifySkill = await readFile(
      path.join(skillRoot, "comet-verify", "SKILL.md"),
      "utf8"
    );

    expect(verifySkill).toContain("harness-comet comet verify --change");
    expect(verifySkill).toContain(
      "Do not create, update, retire, redesign, or repair Playwright assets during Verify."
    );

    const archiveSkill = await readFile(
      path.join(skillRoot, "comet-archive", "SKILL.md"),
      "utf8"
    );

    expect(archiveSkill).toContain(
      "harness-comet comet archive-check --change"
    );

    const authoringSkills = [
      "playwright-impact-analysis",
      "playwright-authoring-decision",
      "playwright-authoring-plan",
      "playwright-authoring-build",
      "playwright-authoring-verify"
    ];

    for (const skill of authoringSkills) {
      const content = await readFile(
        path.join(skillRoot, skill, "SKILL.md"),
        "utf8"
      );

      expect(content).toContain(`name: ${skill}`);
    }

    const manifest = JSON.parse(
      await readFile(
        path.join(root, ".comet", "harness-comet", "manifest.json"),
        "utf8"
      )
    );

    expect(manifest.targets[0].managedFiles).toHaveLength(10);

    expect(
      manifest.targets[0].managedFiles.map(
        (file: { relativePath: string }) => file.relativePath
      )
    ).toEqual(
      expect.arrayContaining([
        "comet-open/SKILL.md",
        "comet-design/SKILL.md",
        "comet-build/SKILL.md",
        "comet-verify/SKILL.md",
        "comet-archive/SKILL.md",
        "playwright-impact-analysis/SKILL.md",
        "playwright-authoring-decision/SKILL.md",
        "playwright-authoring-plan/SKILL.md",
        "playwright-authoring-build/SKILL.md",
        "playwright-authoring-verify/SKILL.md"
      ])
    );
  });

  it("allows explicit platform install before Comet has created the platform directory", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-empty-project-"));

    const install = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--yes"
    ]);

    expect(install.exitCode).toBe(0);
    expect(install.stdout).toContain("TARGET codex writes=5");
    const openSkill = await readFile(path.join(root, ".codex", "skills", "comet-open", "SKILL.md"), "utf8");
    expect(openSkill).toContain("harness-comet:start phase=open");
  });

  it("lets interactive Comet init choose targets before patching detected skills", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-interactive-"));

    const install = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install"
    ]);

    expect(install.exitCode).toBe(0);
    expect(install.stdout).toContain("TARGET codex writes=5");
    const initArgs = await readFile(path.join(root, "comet-init-args.txt"), "utf8");
    expect(initArgs).toContain("init --scope project");
    expect(initArgs).not.toContain("--yes");
  });

  it("ignores platform roots that do not contain Comet skills after interactive init", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-existing-platform-root-"));
    await mkdir(path.join(root, ".github", "workflows"), { recursive: true });
    await mkdir(path.join(root, ".agents", "skills", "brainstorming"), { recursive: true });
    await writeFile(path.join(root, ".agents", "skills", "brainstorming", "SKILL.md"), "# brainstorming\n", "utf8");

    const install = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install"
    ]);

    expect(install.exitCode).toBe(0);
    expect(install.stdout).toContain("TARGET codex writes=5");
    expect(install.stdout).not.toContain("TARGET antigravity");
    expect(install.stdout).not.toContain("TARGET github-copilot");
  });

  it("upgrades existing v1 managed blocks in place during reinstall", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-install-upgrade-v1-"));
    await mkdir(path.join(root, ".codex"), { recursive: true });
    await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--yes"
    ]);

    const openSkillPath = path.join(root, ".codex", "skills", "comet-open", "SKILL.md");
    const installed = await readFile(openSkillPath, "utf8");
    await writeFile(
      openSkillPath,
      installed.replace("version=2", "version=1").replace("Open phase from upstream Comet.", "Legacy open phase"),
      "utf8"
    );

    const reinstall = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--yes",
      "--force"
    ]);

    expect(reinstall.exitCode).toBe(0);
    const next = await readFile(openSkillPath, "utf8");
    expect(next).toContain("version=2");
    expect(next).not.toContain("Legacy open phase");
    expect(next.match(/harness-comet:start phase=open/g)?.length).toBe(1);
  });

});
