import { loadHarnessCometConfig } from "@hapergg/harness-comet-core";
import type { HarnessCometProjectMode } from "./types.js";

export async function resolveHarnessCometProjectMode(
  projectRoot: string,
  override?: HarnessCometProjectMode
): Promise<HarnessCometProjectMode> {
  try {
    const project = await loadHarnessCometConfig({ root: projectRoot });
    return project.config.mode;
  } catch {
    return override ?? "runtime";
  }
}
