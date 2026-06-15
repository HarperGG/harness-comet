export function incidentSpecTemplate(id: string, title?: string, issueUrl?: string): string {
  const renderedTitle = title ?? id;
  const annotationLines = issueUrl
    ? `    { type: "issue-url", description: "${issueUrl}" }\n`
    : "";
  return `import { test } from "@playwright/test";

test("${id}: ${renderedTitle}", {
  tag: ["@harness", "@incident"],
  annotation: [
    { type: "incident", description: "${id}" },
${annotationLines}  ]
}, async () => {
  // Arrange
  // Act
  // Assert
});
`;
}

export function incidentReadmeTemplate(id: string, title?: string): string {
  return `# ${id}

${title ?? id}
`;
}
