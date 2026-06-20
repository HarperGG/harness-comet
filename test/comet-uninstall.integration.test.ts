import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { execa } from "execa";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];
const originalBin = process.env.HARNESS_COMET_COMET_BIN;

afterEach(() => {
  if (originalBin === undefined) delete process.env.HARNESS_COMET_COMET_BIN;
  else process.env.HARNESS_COMET_COMET_BIN = originalBin;
});

async function createFakeComet(version = "0.3.8"): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "fake-comet-bin-"));
  const script = path.join(root, "comet");
  await writeFile(
    script,
    `#!/bin/bash
set -eu
if [ "\${1:-}" = "--version" ]; then
  echo 'comet ${version}'
  exit 0
fi
if [ "\${1:-}" = "init" ]; then
  project_root="\${@: -1}"
  for platform in .codex .cursor; do
    [ -d "$project_root/$platform" ] || continue
    skill_root="$project_root/$platform/skills"
    mkdir -p "$skill_root"/{comet-open,comet-design,comet-build,comet-verify,comet-archive,comet/scripts}
    for phase in open design build verify archive; do
      printf '# comet-%s\\n\\n%s phase from upstream Comet.\\n' "$phase" "$phase" > "$skill_root/comet-$phase/SKILL.md"
    done
    printf '# comet\\n\\nMain Comet skill.\\n' > "$skill_root/comet/SKILL.md"
    printf '#!/bin/sh\\n' > "$skill_root/comet/scripts/comet-state.sh"
    printf '#!/bin/sh\\n' > "$skill_root/comet/scripts/comet-guard.sh"
    printf '#!/bin/sh\\n' > "$skill_root/comet/scripts/comet-archive.sh"
    chmod +x "$skill_root/comet/scripts/"*.sh
  done
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

describe("comet uninstall integration", () => {
  it("removes unchanged managed files and clears the manifest target", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-uninstall-clean-"));
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

    const result = await execa("pnpm", [...cli, "--root", root, "comet", "uninstall"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("TARGET codex removed=5 kept=0");
    const openSkill = await readFile(path.join(root, ".codex", "skills", "comet-open", "SKILL.md"), "utf8");
    expect(openSkill).toContain("open phase from upstream Comet.");
    expect(openSkill).not.toContain("harness-comet:start");
    const manifest = JSON.parse(
      await readFile(path.join(root, ".comet", "harness-comet", "manifest.json"), "utf8")
    );
    expect(manifest.targets).toHaveLength(0);
  });

  it("keeps user-modified managed files during uninstall", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-uninstall-drift-"));
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

    const changedFile = path.join(root, ".codex", "skills", "comet-open", "SKILL.md");
    const original = await readFile(changedFile, "utf8");
    await writeFile(changedFile, `${original}\nuser change\n`, "utf8");

    const result = await execa("pnpm", [...cli, "--root", root, "comet", "uninstall"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("TARGET codex removed=5 kept=0");
    const preserved = await readFile(changedFile, "utf8");
    expect(preserved).toContain("user change");
    expect(preserved).not.toContain("harness-comet:start");
  });

  it("supports platform-scoped uninstall when multiple targets are installed", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-uninstall-platform-"));
    await mkdir(path.join(root, ".codex"), { recursive: true });
    await mkdir(path.join(root, ".cursor"), { recursive: true });
    await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "install",
      "--platform",
      "codex",
      "--platform",
      "cursor",
      "--yes"
    ]);

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "uninstall",
      "--platform",
      "codex"
    ]);

    expect(result.exitCode).toBe(0);
    const codexFile = await readFile(path.join(root, ".codex", "skills", "comet-open", "SKILL.md"), "utf8");
    expect(codexFile).not.toContain("harness-comet:start");
    const cursorFile = await stat(path.join(root, ".cursor", "skills", "comet-open", "SKILL.md"));
    expect(cursorFile.isFile()).toBe(true);
    const cursorSkill = await readFile(path.join(root, ".cursor", "skills", "comet-open", "SKILL.md"), "utf8");
    expect(cursorSkill).toContain("harness-comet:start");
    const manifest = JSON.parse(
      await readFile(path.join(root, ".comet", "harness-comet", "manifest.json"), "utf8")
    );
    expect(manifest.targets).toHaveLength(1);
    expect(manifest.targets[0].platformId).toBe("cursor");
  });
});
