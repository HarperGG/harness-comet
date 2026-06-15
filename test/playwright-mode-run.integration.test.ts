import fs from "node:fs/promises";
import { chmod } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

const bin = path.resolve("packages/cli/src/dev-bin.ts");
const cli = ["tsx", bin];

async function tempProject(): Promise<string> {
  return fs.mkdtemp(path.join(tmpdir(), "harness-playwright-run-"));
}

async function createFakePlaywrightBin(root: string): Promise<string> {
  const binDir = path.join(root, "bin");
  const script = path.join(binDir, "npm");
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(
    script,
    `#!/bin/sh
set -eu
if [ "$1" = "exec" ] && [ "$2" = "playwright" ]; then
  if [ "$HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE" != "" ]; then
    mkdir -p "$(dirname "$HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE")"
    cat > "$HARNESS_COMET_PLAYWRIGHT_RESULTS_OUTPUT_FILE" <<'EOF'
{
  "schemaVersion": 1,
  "generatedAt": "2026-06-16T00:00:00.000Z",
  "tests": [
    {
      "project": "chromium",
      "file": "tests/journeys/example-save-flow.spec.ts",
      "title": "Example save flow",
      "tags": ["@harness"],
      "annotations": [],
      "status": "passed",
      "duration": 12,
      "retry": 0,
      "errors": [],
      "attachments": []
    }
  ]
}
EOF
  fi
  exit 0
fi
exit 1
`,
    "utf8"
  );
  await chmod(script, 0o755);
  return binDir;
}

describe("playwright mode run", () => {
  it("writes results to the configured resultsFile path", async () => {
    const root = await tempProject();
    const fakeBin = await createFakePlaywrightBin(root);
    await fs.writeFile(
      path.join(root, "harness-comet.config.ts"),
      `export default {
  schemaVersion: 1,
  mode: "playwright",
  playwright: {
    configFile: "playwright.config.ts",
    testDir: "tests",
    testMatch: ["**/*.spec.ts"],
    resultsFile: "artifacts/custom-results.json"
  }
};
`,
      "utf8"
    );
    await fs.writeFile(path.join(root, "playwright.config.ts"), "export default { reporter: [[\"list\"]] };\n");
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({ packageManager: "npm@10.8.2" }, null, 2),
      "utf8"
    );
    await fs.mkdir(path.join(root, "tests", "journeys"), { recursive: true });
    await fs.writeFile(path.join(root, "tests", "journeys", "example-save-flow.spec.ts"), "export {};\n");

    const result = await execa(
      "pnpm",
      [...cli, "--root", root, "run", "--", "tests/journeys/example-save-flow.spec.ts"],
      {
        env: {
          ...process.env,
          PATH: `${fakeBin}:${process.env.PATH ?? ""}`
        }
      }
    );

    expect(result.exitCode).toBe(0);
    await expect(fs.stat(path.join(root, "artifacts", "custom-results.json"))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(root, "test-results", "harness-comet", "results.json"))).rejects.toThrow();
  });
});
