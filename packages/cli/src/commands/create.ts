import fs from "node:fs/promises";
import path from "node:path";
import { HarnessError } from "@hapergg/harness-comet-core";
import { incidentReadmeTemplate, incidentSpecTemplate } from "../templates/incident.js";

export interface CreatePlaywrightIncidentOptions {
  root: string;
  testDir: string;
  id: string;
  title?: string;
  issueUrl?: string;
  force?: boolean;
}

export interface CreatePlaywrightIncidentResult {
  ok: true;
  id: string;
  created: string[];
  incidentRoot: string;
}

export async function createPlaywrightIncident(
  options: CreatePlaywrightIncidentOptions
): Promise<CreatePlaywrightIncidentResult> {
  const normalizedId = normalizeIncidentId(options.id);
  const incidentsRoot = path.join(options.root, options.testDir, "incidents");
  const incidentRoot = path.join(incidentsRoot, normalizedId);
  const created: string[] = [];

  await fs.mkdir(incidentRoot, { recursive: true });
  await writeTextFile(
    path.join(incidentRoot, "incident.json"),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        id: normalizedId,
        title: options.title ?? normalizedId,
        ...(options.issueUrl ? { issueUrl: options.issueUrl } : {}),
        status: "created",
        createdAt: new Date().toISOString(),
        testFile: `${normalizedId}.spec.ts`
      },
      null,
      2
    )}\n`,
    Boolean(options.force),
    created
  );
  await writeTextFile(
    path.join(incidentRoot, `${normalizedId}.spec.ts`),
    incidentSpecTemplate(normalizedId, options.title, options.issueUrl),
    Boolean(options.force),
    created
  );
  await writeTextFile(path.join(incidentRoot, "input.json"), "{}\n", Boolean(options.force), created);
  await writeTextFile(
    path.join(incidentRoot, "expected.json"),
    "{}\n",
    Boolean(options.force),
    created
  );
  await writeTextFile(
    path.join(incidentRoot, "README.md"),
    incidentReadmeTemplate(normalizedId, options.title),
    Boolean(options.force),
    created
  );

  return {
    ok: true,
    id: normalizedId,
    created,
    incidentRoot
  };
}

function normalizeIncidentId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new HarnessError({
      code: "PLAYWRIGHT_INCIDENT_ID_INVALID",
      category: "selection",
      message: "Incident id is required"
    });
  }
  if (trimmed.includes("/") || trimmed.includes("\\")) {
    throw new HarnessError({
      code: "PLAYWRIGHT_INCIDENT_ID_INVALID",
      category: "selection",
      message: "Incident id must not contain path separators"
    });
  }
  return trimmed.replace(/\s+/g, "-");
}

async function writeTextFile(
  filePath: string,
  content: string,
  force: boolean,
  created: string[]
): Promise<void> {
  if (!force && (await exists(filePath))) {
    throw new HarnessError({
      code: "PLAYWRIGHT_INCIDENT_EXISTS",
      category: "config",
      message: `Incident file already exists: ${filePath}`
    });
  }
  await fs.writeFile(filePath, content, "utf8");
  created.push(filePath);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
