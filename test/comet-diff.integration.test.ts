import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

describe("comet diff integration", () => {
  it("shows pending patches for a Comet skill root without a manifest", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-diff-pending-"));
    const skillRoot = path.join(root, ".codex", "skills");
    await mkdir(path.join(skillRoot, "comet-open"), { recursive: true });
    await mkdir(path.join(skillRoot, "comet-design"), { recursive: true });
    await mkdir(path.join(skillRoot, "comet-build"), { recursive: true });
    await mkdir(path.join(skillRoot, "comet-verify"), { recursive: true });
    await mkdir(path.join(skillRoot, "comet-archive"), { recursive: true });
    for (const phase of ["open", "design", "build", "verify", "archive"]) {
      await writeFile(path.join(skillRoot, `comet-${phase}`, "SKILL.md"), `# comet-${phase}\n`, "utf8");
    }

    const result = await execa("pnpm", [...cli, "--root", root, "comet", "diff"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("TARGET codex status=pending");
    expect(result.stdout).toContain("FILE create comet-open/SKILL.md");
    expect(result.stdout).toContain("FILE create comet-archive/SKILL.md");
    expect(result.stdout).toContain("MANIFEST missing");
  });

  it("ignores non-Comet skill roots without phase skills", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-diff-ignore-non-comet-"));
    await mkdir(path.join(root, ".github", "skills"), { recursive: true });
    await writeFile(path.join(root, ".github", "skills", "README.md"), "not comet\n", "utf8");

    const result = await execa("pnpm", [...cli, "--root", root, "comet", "diff"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).not.toContain("TARGET github-copilot");
  });

  it("reports a clean target after install", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-diff-clean-"));
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

    const result = await execa("pnpm", [...cli, "--root", root, "comet", "diff"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("TARGET codex status=clean");
    expect(result.stdout).toContain("MANIFEST unchanged");
  });

  it("reports drift when a managed file changes after install", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-diff-drift-"));
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

    const result = await execa("pnpm", [...cli, "--root", root, "comet", "diff"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("TARGET codex status=drift");
    expect(result.stdout).toContain("FILE drift comet-open/SKILL.md");
    expect(result.stdout).toContain("MANIFEST changed");
  });
});
