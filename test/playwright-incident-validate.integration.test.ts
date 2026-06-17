import fs from "node:fs/promises";
import { chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "harness-playwright-incident-validate-"));
}

async function createFakeNpm(root: string): Promise<string> {
  const binDir = path.join(root, "bin");
  const script = path.join(binDir, "npm");
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(
    script,
    `#!/bin/sh
if [ "$1" = "exec" ] && [ "$2" = "playwright" ]; then
  cat <<'EOF'
{
  "suites": [
    {
      "title": "tests/example.spec.ts",
      "file": "tests/example.spec.ts",
      "specs": [
        {
          "title": "Example smoke",
          "tags": ["harness"],
          "tests": [
            {
              "projectName": "chromium",
              "annotations": []
            }
          ]
        }
      ]
    }
  ]
}
EOF
  exit 0
fi
exit 1
`,
    "utf8"
  );
  await chmod(script, 0o755);
  return binDir;
}

describe("incident validation in playwright mode", () => {
  it("fails validate when incident assets are invalid", async () => {
    const root = await tempProject();
    const fakeBin = await createFakeNpm(root);
    await fs.mkdir(path.join(root, "tests", "incidents", "BUG-1842"), { recursive: true });
    await fs.writeFile(
      path.join(root, "harness-comet.config.ts"),
      `export default {
        schemaVersion: 1,
        mode: "playwright",
        playwright: { configFile: "playwright.config.ts", testDir: "tests", testMatch: ["**/*.spec.ts"] },
        incidents: { requireIssueUrl: true, requireReadme: true }
      };`
    );
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ packageManager: "npm@10.8.2" }, null, 2)
    );
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default {};");
    await fs.writeFile(path.join(root, "tests", "example.spec.ts"), `export {};`);
    await fs.writeFile(
      path.join(root, "tests", "incidents", "BUG-1842", "incident.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          id: "BUG-1842",
          title: "Broken incident",
          status: "created",
          createdAt: "2026-06-15T10:00:00.000Z",
          testFile: "../escape.spec.ts"
        },
        null,
        2
      )
    );

    const result = await execa("pnpm", [...cli, "--root", root, "validate"], {
      reject: false,
      env: {
        ...process.env,
        PATH: `${fakeBin}:${process.env.PATH ?? ""}`
      }
    });

    expect(result.exitCode).toBe(2);
    expect(`${result.stdout}\n${result.stderr}`).toContain("Incident issueUrl is required");
  });
});
