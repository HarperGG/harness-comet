#!/usr/bin/env node
import packageJson from "../package.json" with { type: "json" };
import { main } from "../dist/index.js";

if (process.argv.length === 3 && ["--version", "-V"].includes(process.argv[2])) {
  process.stdout.write(`${packageJson.version}\n`);
} else {
  main(process.argv).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 10;
  });
}
