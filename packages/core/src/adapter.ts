import path from "node:path";
import { pathToFileURL } from "node:url";
import type { HarnessAdapter } from "@hapergg/harness-comet-sdk";
import type { LoadedHarnessConfig } from "./config.js";
import { resolveInsideRoot } from "./config.js";
import { HarnessError } from "./errors.js";

export async function loadAdapter(
  config: LoadedHarnessConfig,
  name: string
): Promise<HarnessAdapter> {
  const entry = config.config.adapter.entries[name];
  if (!entry) {
    throw new HarnessError({
      code: "ADAPTER_NOT_CONFIGURED",
      category: "config",
      message: `Adapter is not configured: ${name}`
    });
  }
  try {
    const specifier =
      entry.startsWith(".") || entry.startsWith("/")
        ? pathToFileURL(resolveInsideRoot(config.projectRoot, entry, "adapter entry")).href
        : entry;
    const module = await import(specifier);
    const adapter = (module.default ??
      module.adapter ??
      module.createAdapter?.()) as HarnessAdapter;
    if (!adapter?.name || !adapter.actions || !adapter.inspectors) {
      throw new Error("Adapter must export name, actions, and inspectors");
    }
    return adapter;
  } catch (error) {
    throw new HarnessError({
      code: "ADAPTER_IMPORT_FAILED",
      category: "adapter",
      message: error instanceof Error ? error.message : String(error),
      file: path.resolve(config.projectRoot, entry)
    });
  }
}
