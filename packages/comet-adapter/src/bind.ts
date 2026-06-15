import path from "node:path";
import { execa } from "execa";
import { HarnessError } from "@harness-comet/core";
import { readManifest } from "./manifest.js";
import { readChangeCometYaml } from "./change.js";
import type { CometBindReport } from "./types.js";

export async function bindCometVerifyCommand(
  projectRoot: string,
  change: string
): Promise<CometBindReport> {
  const manifest = await readManifest(projectRoot);
  if (!manifest || manifest.targets.length === 0) {
    throw new HarnessError({
      code: "COMET_MANIFEST_MISSING",
      category: "config",
      message: "No harness-comet manifest found for comet bind"
    });
  }

  const stateScript = path.join(manifest.targets[0].skillRoot, "comet", "scripts", "comet-state.sh");
  const command = `harness-comet comet verify --change ${change}`;
  await execa(stateScript, ["set", change, "verify_command", command], {
    cwd: projectRoot
  });

  const { path: cometYamlPath, data } = await readChangeCometYaml(projectRoot, change);
  if (data.verify_command !== command) {
    throw new HarnessError({
      code: "COMET_VERIFY_COMMAND_BIND_FAILED",
      category: "comet",
      message: `verify_command was not written for ${change}`,
      path: cometYamlPath
    });
  }

  return {
    change,
    cometYamlPath,
    command
  };
}
