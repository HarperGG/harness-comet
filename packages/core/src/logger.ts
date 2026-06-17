import type { JsonValue } from "@hapergg/harness-comet-schema";
import type { HarnessLogger } from "@hapergg/harness-comet-sdk";

export function createLogger(options: { quiet?: boolean; verbose?: boolean } = {}): HarnessLogger {
  const write = (level: string, message: string, meta?: Record<string, JsonValue>) => {
    if (options.quiet && level !== "error") return;
    if (level === "debug" && !options.verbose) return;
    const suffix = meta ? ` ${JSON.stringify(meta)}` : "";
    process.stderr.write(`[${level}] ${message}${suffix}\n`);
  };
  return {
    error: (message, meta) => write("error", message, meta),
    warn: (message, meta) => write("warn", message, meta),
    info: (message, meta) => write("info", message, meta),
    debug: (message, meta) => write("debug", message, meta)
  };
}

export const silentLogger: HarnessLogger = {
  error: () => undefined,
  warn: () => undefined,
  info: () => undefined,
  debug: () => undefined
};
