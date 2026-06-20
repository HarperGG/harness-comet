import { readFile, writeFile } from "node:fs/promises";

const file = "packages/comet-adapter/src/hooks.ts";
let text = await readFile(file, "utf8");

const replacements = [
  [
    'const enabledMatch = decision.match(/\\benabled:\\s*(true|false)\\b/i);',
    'const enabledMatch = decision.match(/\\benabled:\\s*["\\\']?(true|false)["\\\']?(?:\\s*(?:#.*)?)?$/im);'
  ],
  [
    'const confirmedByMatch = decision.match(/\\bconfirmedBy:\\s*([a-z-]+)\\b/i);',
    'const confirmedByMatch = decision.match(/\\bconfirmedBy:\\s*["\\\']?([a-z-]+)["\\\']?(?:\\s*(?:#.*)?)?$/im);'
  ],
  [
    'const operationMatches = [...decision.matchAll(/^\\s*operation:\\s*([a-z-]+)\\s*$/gim)];',
    'const operationMatches = [\n    ...decision.matchAll(/^\\s*(?:-\\s*)?operation:\\s*["\\\']?([a-z-]+)["\\\']?(?:\\s*(?:#.*)?)?$/gim)\n  ];'
  ],
  [
    '  const activeOperations = operationMatches\n    .map((match) => match[1].toLowerCase())\n    .filter((operation) => operation !== "ignore");\n  if (enabled && activeOperations.length === 0) {',
    '  if (enabled && operationMatches.length === 0) {\n    throw new HarnessError({\n      code: "COMET_OPEN_DECISION_OPERATION_MISSING",\n      category: "config",\n      message: `No Playwright target operations could be parsed for ${change}. Use operation: verify|update|create|retire|ignore.`,\n      path: proposalPath\n    });\n  }\n\n  const activeOperations = operationMatches\n    .map((match) => match[1].toLowerCase())\n    .filter((operation) => operation !== "ignore");\n  if (enabled && activeOperations.length === 0) {'
  ]
];

for (const [before, after] of replacements) {
  if (!text.includes(before)) throw new Error(`Expected hook fragment not found: ${before}`);
  text = text.replace(before, after);
}

await writeFile(file, text);
