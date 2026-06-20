import { readFile, writeFile } from "node:fs/promises";

const file = "test/comet-install.integration.test.ts";
const current = await readFile(file, "utf8");
const next = current.replace("`#!/bin/sh\nset -eu", "`#!/bin/bash\nset -eu");
if (next === current) throw new Error("Fake Comet shebang was not updated");
await writeFile(file, next);
