import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const managedRoot = path.join(
  root,
  "packages/comet-adapter/assets/comet-skills/playwright"
);

const configs = {
  en: {
    blockPath: path.join(root, "scripts/assets/archive-project-knowledge.en.md"),
    skillPath: path.join(managedRoot, "en/comet-archive/SKILL.md"),
    replacements: [
      ["### Harness/Playwright Archive Preflight", "### 2. Harness/Playwright Archive Preflight"],
      [
        "Before the upstream final archive confirmation, if the project is in Playwright mode and the change has a Playwright decision, plan, or Harness receipt, run:",
        "After project knowledge review is completed, skipped, or confirmed unnecessary, if the project is in Playwright mode and the change has a Playwright decision, plan, or Harness receipt, run:"
      ],
      ["### 1. Final Archive Confirmation (Blocking Point)", "### 3. Final Archive Confirmation (Blocking Point)"],
      [
        "After entry verification passes, **must follow the `comet/reference/decision-point.md` protocol to pause and wait for the user to confirm whether to archive immediately**.",
        "After project knowledge review and archive preflight complete, **must follow the `comet/reference/decision-point.md` protocol to pause and wait for the user to confirm whether to archive immediately**."
      ],
      ["- Branch handling status\n", "- Branch handling status\n- Project knowledge update result: updated, unnecessary, or skipped by user\n"],
      ["Only after the user selects \"Confirm archive\" may Step 2 continue.", "Only after the user selects \"Confirm archive\" may Step 4 continue."],
      ["### 2. Execute Archive", "### 4. Execute Archive"],
      ["### 3. Lifecycle Closed Loop", "### 5. Lifecycle Closed Loop"],
      [
        "brainstorming → delta spec → implementation → verification → main spec merge → design doc annotation → archive",
        "brainstorming → delta spec → implementation → verification → project knowledge update → main spec merge → design doc annotation → archive"
      ]
    ]
  },
  zh: {
    blockPath: path.join(root, "scripts/assets/archive-project-knowledge.zh.md"),
    skillPath: path.join(managedRoot, "zh/comet-archive/SKILL.md"),
    replacements: [
      ["### Harness/Playwright 归档预检", "### 2. Harness/Playwright 归档预检"],
      [
        "上游最终归档确认前，如果项目为 Playwright 模式且 change 有 Playwright 决策、规划或 Harness receipt，运行：",
        "项目知识更新完成、被用户跳过或确认无需更新后，如果项目为 Playwright 模式且 change 有 Playwright 决策、规划或 Harness receipt，运行："
      ],
      ["### 1. 归档前最终确认（阻塞点）", "### 3. 归档前最终确认（阻塞点）"],
      [
        "入口验证通过后，**必须按 `comet/reference/decision-point.md` 的协议暂停并等待用户确认是否立即归档**。",
        "项目知识更新和归档预检完成后，**必须按 `comet/reference/decision-point.md` 的协议暂停并等待用户确认是否立即归档**。"
      ],
      ["- 分支处理状态\n", "- 分支处理状态\n- 项目知识更新结果：已更新、无需更新或用户选择跳过\n"],
      ["只有用户选择「确认归档」后，才允许继续 Step 2。", "只有用户选择「确认归档」后，才允许继续 Step 4。"],
      ["### 2. 执行归档", "### 4. 执行归档"],
      ["### 3. 生命周期闭环", "### 5. 生命周期闭环"],
      [
        "brainstorming → delta spec → 实施 → 验证 → 主 spec 合并 → design doc 标注 → 归档",
        "brainstorming → delta spec → 实施 → 验证 → 项目知识更新 → 主 spec 合并 → design doc 标注 → 归档"
      ]
    ]
  }
};

for (const config of Object.values(configs)) {
  let source = await readFile(config.skillPath, "utf8");
  const block = (await readFile(config.blockPath, "utf8")).trim();
  source = removeManagedBlock(source, "archive-project-knowledge");

  const preflight = "<!-- HARNESS-COMET:BEGIN archive-preflight -->";
  const index = source.indexOf(preflight);
  if (index === -1) throw new Error(`Archive preflight marker missing: ${config.skillPath}`);
  source = `${source.slice(0, index)}${block}\n\n${source.slice(index)}`;

  for (const [before, after] of config.replacements) {
    if (!source.includes(before)) {
      throw new Error(`Expected archive fragment missing in ${config.skillPath}: ${before}`);
    }
    source = source.replace(before, after);
  }

  await writeFile(config.skillPath, source, "utf8");
}

function removeManagedBlock(source, name) {
  const startMarker = `<!-- HARNESS-COMET:BEGIN ${name} -->`;
  const endMarker = `<!-- HARNESS-COMET:END ${name} -->`;
  const start = source.indexOf(startMarker);
  if (start === -1) return source;
  const end = source.indexOf(endMarker, start);
  if (end === -1) throw new Error(`Unclosed managed block: ${name}`);
  return `${source.slice(0, start)}${source.slice(end + endMarker.length).replace(/^\s*/, "")}`;
}
