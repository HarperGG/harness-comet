import { z } from "zod";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema)
  ])
);

export const IdSchema = z
  .string()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "IDs must use lowercase letters, numbers, and dashes");

export const ScenarioBusinessV1Schema = z.object({
  component: z.string().min(1),
  capability: z.string().min(1),
  behavior: z.string().min(1),
  contract: IdSchema.optional(),
  status: z.enum(["active", "deprecated"]).optional(),
  supersedes: z.array(IdSchema).optional()
});

export const FixtureBusinessV1Schema = z.object({
  purpose: z.string().min(1),
  scope: z.enum(["shared", "scenario"]),
  consumers: z.array(z.string().min(1)).optional()
});

export const ScenarioStepV1Schema = z.object({
  id: IdSchema.optional(),
  action: z.string().min(1),
  input: JsonValueSchema.optional(),
  timeoutMs: z.number().int().positive().optional(),
  continueOnError: z.boolean().optional()
});

export const ScenarioAssertionV1Schema = z
  .object({
    id: IdSchema.optional(),
    inspect: z.string().min(1),
    oracle: z.string().min(1),
    input: JsonValueSchema.optional(),
    expected: JsonValueSchema.optional(),
    expectedRef: z.string().min(1).optional(),
    blocking: z.boolean().optional()
  })
  .refine((value) => (value.expected === undefined) !== (value.expectedRef === undefined), {
    message: "expected and expectedRef are mutually exclusive and one is required"
  });

export const ScenarioV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: IdSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
  business: ScenarioBusinessV1Schema.optional(),
  fixtureRefs: z.array(IdSchema).optional(),
  adapter: z.string().min(1).optional(),
  timeoutMs: z.number().int().positive().optional(),
  steps: z.array(ScenarioStepV1Schema),
  assertions: z.array(ScenarioAssertionV1Schema)
});

export const FixtureMetadataV1Schema = z
  .object({
    schemaVersion: z.literal(1),
    id: IdSchema,
    description: z.string().optional(),
    business: FixtureBusinessV1Schema.optional(),
    dataFile: z.string().min(1).optional(),
    inline: JsonValueSchema.optional(),
    source: z.enum(["synthetic", "test", "redacted-production"]).optional(),
    containsSensitiveData: z.boolean().optional()
  })
  .refine((value) => (value.dataFile === undefined) !== (value.inline === undefined), {
    message: "dataFile and inline are mutually exclusive and one is required"
  });

export const HarnessConfigV1Schema = z.object({
  schemaVersion: z.literal(1).optional(),
  rootDir: z.string().optional(),
  paths: z
    .object({
      scenarios: z.string().optional(),
      fixtures: z.string().optional(),
      adapters: z.string().optional(),
      oracles: z.string().optional()
    })
    .optional(),
  adapter: z.object({
    default: z.string().min(1),
    entries: z.record(z.string().min(1))
  }),
  runtime: z
    .object({
      scenarioTimeoutMs: z.number().int().positive().optional(),
      stepTimeoutMs: z.number().int().positive().optional(),
      assertionTimeoutMs: z.number().int().positive().optional(),
      workers: z.number().int().positive().optional(),
      failFast: z.boolean().optional()
    })
    .optional(),
  playwright: z
    .object({
      enabled: z.boolean().optional(),
      browser: z.enum(["chromium", "firefox", "webkit"]).optional(),
      headless: z.boolean().optional(),
      baseUrl: z.string().optional(),
      viewport: z
        .object({ width: z.number().int().positive(), height: z.number().int().positive() })
        .optional(),
      locale: z.string().optional(),
      timezoneId: z.string().optional(),
      storageState: z.string().optional(),
      webServer: z
        .object({
          command: z.string().min(1),
          url: z.string().min(1),
          timeoutMs: z.number().int().positive().optional(),
          reuseExistingServer: z.boolean().optional()
        })
        .optional()
    })
    .optional()
});

export const HarnessProjectModeSchema = z.enum(["runtime", "playwright"]);
export const ImpactModeSchema = z.enum(["full", "maintain", "off"]);
export const ImpactDecisionSchema = z.enum([
  "reuse",
  "update",
  "extend",
  "create",
  "deprecate",
  "none"
]);

export const RuntimeModeConfigV1Schema = HarnessConfigV1Schema.extend({
  mode: z.literal("runtime")
});

export const PlaywrightModeConfigV1Schema = z
  .object({
    schemaVersion: z.literal(1).optional(),
    mode: z.literal("playwright"),
    playwright: z.object({
      configFile: z.string().min(1).default("playwright.config.ts"),
      testDir: z.string().min(1).default("tests"),
      testMatch: z.array(z.string().min(1)).default(["**/*.spec.ts"])
    }),
    docs: z
      .object({
        testingDir: z.string().min(1).default("docs/testing")
      })
      .optional(),
    impact: z
      .object({
        defaultMode: ImpactModeSchema.default("maintain"),
        requireOpenImpact: z.boolean().default(true),
        requireDesignDecision: z.boolean().default(true),
        requireVerifyEvidence: z.boolean().default(true)
      })
      .optional()
  })
  .strict();

export const HarnessCometConfigV1Schema = z.union([
  RuntimeModeConfigV1Schema,
  PlaywrightModeConfigV1Schema
]);

export const DifferenceSchema = z.object({
  path: z.string(),
  type: z.enum(["missing", "unexpected", "value-mismatch", "type-mismatch", "schema-mismatch"]),
  expected: JsonValueSchema.optional(),
  actual: JsonValueSchema.optional(),
  message: z.string().optional()
});

export const RunResultV1Schema = z.object({
  schemaVersion: z.literal(1),
  runId: z.string(),
  status: z.enum(["passed", "failed", "error", "cancelled"]),
  startedAt: z.string(),
  completedAt: z.string(),
  durationMs: z.number(),
  scenarios: z.array(z.any()),
  summary: z.object({
    total: z.number(),
    passed: z.number(),
    failed: z.number(),
    error: z.number(),
    cancelled: z.number()
  })
});

export type Difference = z.infer<typeof DifferenceSchema>;
export type ScenarioBusinessV1 = z.infer<typeof ScenarioBusinessV1Schema>;
export type FixtureBusinessV1 = z.infer<typeof FixtureBusinessV1Schema>;
export type ScenarioStepV1 = z.infer<typeof ScenarioStepV1Schema>;
export type ScenarioAssertionV1 = z.infer<typeof ScenarioAssertionV1Schema>;
export type ScenarioV1 = z.infer<typeof ScenarioV1Schema>;
export type FixtureMetadataV1 = z.infer<typeof FixtureMetadataV1Schema>;
export type HarnessConfigV1 = z.infer<typeof HarnessConfigV1Schema>;
export type HarnessProjectMode = z.infer<typeof HarnessProjectModeSchema>;
export type ImpactMode = z.infer<typeof ImpactModeSchema>;
export type ImpactDecision = z.infer<typeof ImpactDecisionSchema>;
export type RuntimeModeConfigV1 = z.infer<typeof RuntimeModeConfigV1Schema>;
export type PlaywrightModeConfigV1 = z.infer<typeof PlaywrightModeConfigV1Schema>;
export type HarnessCometConfigV1 = z.infer<typeof HarnessCometConfigV1Schema>;

export interface HarnessErrorShape {
  code: string;
  category:
    | "config"
    | "schema"
    | "selection"
    | "environment"
    | "adapter"
    | "action"
    | "inspector"
    | "oracle"
    | "playwright"
    | "comet"
    | "internal";
  message: string;
  hint?: string;
  file?: string;
  path?: string;
  context?: Record<string, JsonValue>;
}

export interface ActionRunResultV1 {
  id: string;
  action: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: HarnessErrorShape;
}

export interface AssertionRunResultV1 {
  id: string;
  inspect: string;
  oracle: string;
  status: "passed" | "failed" | "error";
  blocking: boolean;
  durationMs: number;
  actual?: JsonValue;
  expected?: JsonValue;
  differences?: Difference[];
  message?: string;
  error?: HarnessErrorShape;
}

export interface ScenarioRunResultV1 {
  id: string;
  title: string;
  status: "passed" | "failed" | "error" | "cancelled";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  steps: ActionRunResultV1[];
  assertions: AssertionRunResultV1[];
  errors?: HarnessErrorShape[];
}

export interface RunResultV1 {
  schemaVersion: 1;
  runId: string;
  status: "passed" | "failed" | "error" | "cancelled";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  scenarios: ScenarioRunResultV1[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    error: number;
    cancelled: number;
  };
}

export function defineHarnessConfig(config: HarnessConfigV1): HarnessConfigV1 {
  return config;
}
