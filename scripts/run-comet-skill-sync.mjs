import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const sourcePath = new URL("./sync-comet-managed-skills.mjs", import.meta.url);
let source = await readFile(sourcePath, "utf8");

const replacements = [
  [
    ': "### 2. 更新计划状态并提供 Plan-Ready 暂停点";',
    ': "### 2. 更新计划状态并提供 plan-ready 暂停点";'
  ],
  [
    'result = insertBefore(result, "## Exit Conditions", b.openBeforeExit, `${language}/open exit`);',
    'result = insertBefore(result, language === "en" ? "## Exit Conditions" : "## 退出条件", b.openBeforeExit, `${language}/open exit`);'
  ],
  [
    'const debug = language === "en"\n      ? "### 3b. In-Execution Debugging (Debug Gate)"\n      : "### 3b. 执行中异常调试（Debug Gate）";',
    'const debug = language === "en"\n      ? "### 4. Spec Incremental Updates"\n      : "### 4. Spec 增量更新";'
  ],
  [
    'result = insertBefore(result, "## Exit Conditions", b.buildBeforeExit, `${language}/build exit`);',
    'result = insertBefore(result, language === "en" ? "## Exit Conditions" : "## 退出条件", b.buildBeforeExit, `${language}/build exit`);'
  ]
];

for (const [before, after] of replacements) {
  if (!source.includes(before)) {
    throw new Error(`Expected generator fragment not found: ${before}`);
  }
  source = source.replace(before, after);
}

const temporaryPath = "/tmp/sync-comet-managed-skills.localized.mjs";
await writeFile(temporaryPath, source, "utf8");
await import(pathToFileURL(temporaryPath).href);
