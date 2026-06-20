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

async function createFakeComet(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "fake-comet-setup-"));
  const script = path.join(root, "comet");
  await writeFile(
    script,
    `#!/bin/sh
set -eu
if [ "\${1:-}" = "--version" ]; then
  echo 'comet 0.3.8'
  exit 0
fi
if [ "\${1:-}" = "init" ]; then
  project_root=""
  for arg in "$@"; do project_root="$arg"; done
  mkdir -p "$project_root/.codex/skills/comet-open" "$project_root/.codex/skills/comet-design" "$project_root/.codex/skills/comet-build" "$project_root/.codex/skills/comet-verify" "$project_root/.codex/skills/comet-archive" "$project_root/.codex/skills/comet/scripts"
  printf '# comet-open\n' > "$project_root/.codex/skills/comet-open/SKILL.md"
  printf '# comet-design\n' > "$project_root/.codex/skills/comet-design/SKILL.md"
  printf '# comet-build\n' > "$project_root/.codex/skills/comet-build/SKILL.md"
  printf '# comet-verify\n' > "$project_root/.codex/skills/comet-verify/SKILL.md"
  printf '# comet-archive\n' > "$project_root/.codex/skills/comet-archive/SKILL.md"
  printf '#!/bin/sh\n' > "$project_root/.codex/skills/comet/scripts/comet-state.sh"
  printf '#!/bin/sh\n' > "$project_root/.codex/skills/comet/scripts/comet-guard.sh"
  printf '#!/bin/sh\n' > "$project_root/.codex/skills/comet/scripts/comet-archive.sh"
  chmod +x "$project_root/.codex/skills/comet/scripts/"*.sh
  exit 0
fi
exit 1
`,
    "utf8"
  );
  await chmod(script, 0o755);
  return script;
}

describe("unified setup command", () => {
  it("initializes Playwright Harness and Comet for detected platforms without --platform", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet();
    const root = await mkdtemp(path.join(tmpdir(), "harness-comet-setup-"));
    await mkdir(path.join(root, ".codex"), { recursive: true });

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "setup",
      "--mode",
      "playwright",
      "--test-dir",
      "tests",
      "--skip-install",
      "--skip-browsers",
      "--yes"
    ]);

    expect(result.exitCode).toBe(0);
    const config = await readFile(path.join(root, "harness-comet.config.ts"), "utf8");
    expect(config).toContain('mode: "playwright"');

    const openSkill = await readFile(
      path.join(root, ".codex", "skills", "comet-open", "SKILL.md"),
      "utf8"
    );
    expect(openSkill).toContain("HARNESS-COMET:BEGIN open-impact");
    expect(openSkill).toContain("playwright-impact-analysis");
  });
});
