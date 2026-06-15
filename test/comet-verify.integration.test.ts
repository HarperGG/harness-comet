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
    cat > "$skill_root/comet/scripts/comet-state.sh" <<'STATE'
#!/bin/sh
set -eu
command="$1"
change="$2"
key="$3"
value="$4"
[ "$command" = "set" ] || exit 1
yaml_path="openspec/changes/$change/.comet.yaml"
node - "$yaml_path" "$key" "$value" <<'NODE'
const fs = require("node:fs");
const [yamlPath, key, value] = process.argv.slice(2);
const lines = fs.existsSync(yamlPath) ? fs.readFileSync(yamlPath, "utf8").split(/\\r?\\n/).filter(Boolean) : [];
const rendered = JSON.stringify(value);
let replaced = false;
const next = lines.map((line) => {
  if (line.startsWith(key + ":")) {
    replaced = true;
    return key + ": " + rendered;
  }
  return line;
});
if (!replaced) next.push(key + ": " + rendered);
fs.writeFileSync(yamlPath, next.join("\\n") + "\\n", "utf8");
NODE
STATE
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

async function initGitRepo(root: string): Promise<void> {
  await execa("git", ["init"], { cwd: root });
  await execa("git", ["config", "user.name", "Harness Comet"], { cwd: root });
  await execa("git", ["config", "user.email", "harness@example.com"], { cwd: root });
}

async function commitAll(root: string, message: string): Promise<void> {
  await execa("git", ["add", "."], { cwd: root });
  await execa("git", ["commit", "-m", message], { cwd: root });
}

async function createChangeArtifacts(root: string, change: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    "phase: verify\ndesign_doc: design.md\n",
    "utf8"
  );
  await writeFile(
    path.join(changeRoot, "design.md"),
    `## Harness Impact

- Mode: maintain
- Reason: keep existing assets aligned
- Affected capabilities:
  - component: example-memory
  - capability: store-message
  - behavior: write-and-read-message
- Existing asset candidates:
  - scenario: example-smoke
- Asset decisions:
  - reuse scenario example-smoke candidate pending review

## Harness Design

### Impact Mode

- Mode: maintain
- Reason: keep existing assets aligned

### Asset Decision Table

| assetType | assetId | decision | reason | contractChange | evidence |
| --------- | ------- | -------- | ------ | -------------- | -------- |
| scenario | example-smoke | reuse | existing scenario still matches | no | impact-analyze |

### Scenario Decision
- reuse example-smoke

### Fixture Decision
- reuse example-empty

### Adapter Decision
- reuse adapter memory surface pending review

### Oracle Decision
- reuse oracle value.equals pending review
`,
    "utf8"
  );
}

async function createOffChangeArtifacts(root: string, change: string): Promise<void> {
  const changeRoot = path.join(root, "openspec", "changes", change);
  await mkdir(changeRoot, { recursive: true });
  await writeFile(
    path.join(changeRoot, ".comet.yaml"),
    "phase: verify\ndesign_doc: design.md\n",
    "utf8"
  );
  await writeFile(
    path.join(changeRoot, "design.md"),
    `## Harness Impact

- Mode: off
- Reason: project has no Harness onboarding
- Affected capabilities:
  - none
- Existing asset candidates:
  - none
- Asset decisions:
  - none
`,
    "utf8"
  );
}

describe("comet verify integration", () => {
  it("bind writes verify_command into the change .comet.yaml", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-bind-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
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
    await createChangeArtifacts(root, "demo-change");

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "bind",
      "--change",
      "demo-change"
    ]);

    expect(result.exitCode).toBe(0);
    const cometYaml = await readFile(
      path.join(root, "openspec", "changes", "demo-change", ".comet.yaml"),
      "utf8"
    );
    expect(cometYaml).toContain(
      'verify_command: "harness-comet comet verify --change demo-change"'
    );
  });

  it("verify runs selected scenarios and writes a receipt", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-verify-run-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    await createChangeArtifacts(root, "demo-change");
    await commitAll(root, "init project");

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "verify",
      "--change",
      "demo-change"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("STATUS passed");
    expect(result.stdout).toContain("REUSED false");
    const receiptPath = path.join(
      root,
      "openspec",
      "changes",
      "demo-change",
      ".comet",
      "harness",
      "verify-receipt.json"
    );
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    expect(receipt).toMatchObject({
      schemaVersion: 1,
      change: "demo-change",
      status: "passed",
      selectedScenarios: ["example-smoke"]
    });
  });

  it("verify reuses a valid PASS receipt on repeated execution", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-verify-reuse-"));
    await initGitRepo(root);
    await execa("pnpm", [...cli, "--root", root, "init", "--adapter", "memory", "--yes"]);
    await createChangeArtifacts(root, "demo-change");
    await commitAll(root, "init project");

    await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "verify",
      "--change",
      "demo-change"
    ]);

    const second = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "verify",
      "--change",
      "demo-change"
    ]);

    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("STATUS passed");
    expect(second.stdout).toContain("REUSED true");
  });

  it("verify skips Harness execution for off mode in a project without Harness", async () => {
    process.env.HARNESS_COMET_COMET_BIN = await createFakeComet("0.3.8");
    const root = await mkdtemp(path.join(tmpdir(), "comet-verify-off-"));
    await initGitRepo(root);
    await createOffChangeArtifacts(root, "demo-change");
    await commitAll(root, "init project");

    const result = await execa("pnpm", [
      ...cli,
      "--root",
      root,
      "comet",
      "verify",
      "--change",
      "demo-change"
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("STATUS passed");
    expect(result.stdout).toContain("SCENARIOS");
    expect(result.stdout).toContain("REUSED false");
  });
});
