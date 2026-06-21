import type { GuidanceLanguage } from "./project-guidance-templates.js";

export const GUIDANCE_START = "<!-- HARNESS-COMET:BEGIN project-context -->";
export const GUIDANCE_END = "<!-- HARNESS-COMET:END project-context -->";

export function renderGuidanceEntry(
  platformId: string,
  language: GuidanceLanguage
): string {
  const frontmatter = platformId === "cursor"
    ? "---\ndescription: Harness-Comet project knowledge\nalwaysApply: true\n---\n\n"
    : "";
  const body = language === "zh" ? chineseBody() : englishBody();
  return `${frontmatter}${GUIDANCE_START}\n\n${body}\n\n${GUIDANCE_END}`;
}

function englishBody(): string {
  return "## Harness-Comet Project Context\n\nRead before changing code:\n\n- Project red lines and engineering guidelines: `.agents/rules.md`\n- Project structure and module responsibilities: `.agents/structure.md`\n\nRespect all project red lines. Feature and bug changes should follow the Comet workflow and complete required Harness-Comet verification.";
}

function chineseBody(): string {
  return "## Harness-Comet \u9879\u76ee\u4e0a\u4e0b\u6587\n\n\u4fee\u6539\u4ee3\u7801\u524d\u8bf7\u9605\u8bfb\uff1a\n\n- \u9879\u76ee\u7ea2\u7ebf\u548c\u5de5\u7a0b\u51c6\u5219\uff1a`.agents/rules.md`\n- \u9879\u76ee\u7ed3\u6784\u548c\u6a21\u5757\u804c\u8d23\uff1a`.agents/structure.md`\n\n\u5fc5\u987b\u9075\u5b88\u9879\u76ee\u7ea2\u7ebf\u3002\u9700\u6c42\u3001\u529f\u80fd\u548c Bug \u4fee\u6539\u5e94\u9075\u5faa Comet \u5de5\u4f5c\u6d41\uff0c\u5e76\u5b8c\u6210 Harness-Comet \u8981\u6c42\u7684\u9a8c\u8bc1\u3002";
}
