import fs from "node:fs/promises";
import type { Dirent } from "node:fs";
import path from "node:path";
import { IncidentRecordV1Schema, type IncidentRecordV1 } from "@harness-comet/schema";
import { HarnessError } from "../errors.js";

export interface ValidatePlaywrightIncidentsOptions {
  incidentsDirectory: string;
  requireIssueUrl: boolean;
  requireReadme: boolean;
}

export interface PlaywrightIncidentValidationResult {
  incidents: IncidentRecordV1[];
  errors: HarnessError[];
  warnings: HarnessError[];
}

export async function validatePlaywrightIncidents(
  root: string,
  options: ValidatePlaywrightIncidentsOptions
): Promise<PlaywrightIncidentValidationResult> {
  const incidentsRoot = path.resolve(root, options.incidentsDirectory);
  const entries = await readDirectoryEntries(incidentsRoot);
  const incidents: IncidentRecordV1[] = [];
  const errors: HarnessError[] = [];
  const warnings: HarnessError[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const incidentDir = path.join(incidentsRoot, entry.name);
    const metadataPath = path.join(incidentDir, "incident.json");
    let incident: IncidentRecordV1 | undefined;
    let rawIncident: Record<string, unknown> | undefined;

    try {
      const metadata = await fs.readFile(metadataPath, { encoding: "utf8" });
      rawIncident = JSON.parse(metadata) as Record<string, unknown>;
      incident = IncidentRecordV1Schema.parse(rawIncident);
    } catch (error) {
      errors.push(
        new HarnessError({
          code: "PLAYWRIGHT_INCIDENT_INVALID",
          category: "schema",
          message: error instanceof Error ? error.message : String(error),
          path: metadataPath
        })
      );
    }

    if (incident) incidents.push(incident);

    const incidentId =
      incident?.id ?? (typeof rawIncident?.id === "string" ? rawIncident.id : undefined);
    if (incidentId && incidentId !== entry.name) {
      errors.push(
        new HarnessError({
          code: "PLAYWRIGHT_INCIDENT_INVALID",
          category: "schema",
          message: `Incident id must match directory name: ${entry.name}`,
          path: metadataPath
        })
      );
    }
    const createdAt =
      incident?.createdAt ??
      (typeof rawIncident?.createdAt === "string" ? rawIncident.createdAt : undefined);
    if (createdAt && Number.isNaN(Date.parse(createdAt))) {
      errors.push(
        new HarnessError({
          code: "PLAYWRIGHT_INCIDENT_INVALID",
          category: "schema",
          message: `Incident createdAt must be a valid ISO timestamp`,
          path: metadataPath
        })
      );
    }
    if (options.requireIssueUrl && !incident?.issueUrl) {
      errors.push(
        new HarnessError({
          code: "PLAYWRIGHT_INCIDENT_INVALID",
          category: "schema",
          message: `Incident issueUrl is required`,
          path: metadataPath
        })
      );
    }

    const testFile =
      incident?.testFile ??
      (typeof rawIncident?.testFile === "string" ? rawIncident.testFile : undefined);
    if (testFile) {
      const resolvedTestFile = path.resolve(incidentDir, testFile);
      if (!isPathInsideRoot(incidentDir, resolvedTestFile) || path.dirname(resolvedTestFile) !== incidentDir) {
        errors.push(
          new HarnessError({
            code: "PLAYWRIGHT_INCIDENT_INVALID",
            category: "schema",
            message: `Incident testFile must stay inside the incident directory`,
            path: metadataPath
          })
        );
      } else if (!(await exists(resolvedTestFile))) {
        errors.push(
          new HarnessError({
            code: "PLAYWRIGHT_INCIDENT_INVALID",
            category: "schema",
            message: `Incident test file is missing: ${testFile}`,
            path: metadataPath
          })
        );
      }
    }

    for (const jsonFile of ["input.json", "expected.json"]) {
      const fullPath = path.join(incidentDir, jsonFile);
      if (!(await exists(fullPath))) continue;
      try {
        const jsonContent = await fs.readFile(fullPath, { encoding: "utf8" });
        JSON.parse(jsonContent);
      } catch (error) {
        errors.push(
          new HarnessError({
            code: "PLAYWRIGHT_INCIDENT_JSON_INVALID",
            category: "schema",
            message: error instanceof Error ? error.message : String(error),
            path: fullPath
          })
        );
      }
    }

    if (options.requireReadme && !(await exists(path.join(incidentDir, "README.md")))) {
      errors.push(
        new HarnessError({
          code: "PLAYWRIGHT_INCIDENT_README_MISSING",
          category: "config",
          message: `Incident README is required`,
          path: path.join(incidentDir, "README.md")
        })
      );
    }
  }

  return { incidents, errors, warnings };
}

async function readDirectoryEntries(directory: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isPathInsideRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
