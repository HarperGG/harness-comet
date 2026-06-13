import type { Difference, JsonValue, ScenarioV1 } from "@harness-comet/schema";

export interface HarnessLogger {
  error(message: string, meta?: Record<string, JsonValue>): void;
  warn(message: string, meta?: Record<string, JsonValue>): void;
  info(message: string, meta?: Record<string, JsonValue>): void;
  debug(message: string, meta?: Record<string, JsonValue>): void;
}

export interface RunContext {
  runId: string;
  projectRoot: string;
  scenario: ScenarioV1;
  fixtures: ReadonlyMap<string, JsonValue>;
  values: Map<string, JsonValue>;
  signal: AbortSignal;
  logger: HarnessLogger;
}

export interface ActionResult {
  value?: JsonValue;
  values?: Record<string, JsonValue>;
}

export interface HarnessAction<TInput extends JsonValue = JsonValue> {
  execute(input: TInput, context: RunContext): Promise<ActionResult>;
}

export interface HarnessInspector<TInput extends JsonValue = JsonValue> {
  inspect(input: TInput, context: RunContext): Promise<JsonValue>;
}

export interface OracleResult {
  passed: boolean;
  differences?: Difference[];
  message?: string;
}

export interface HarnessOracle {
  evaluate(args: {
    actual: JsonValue;
    expected: JsonValue;
    input?: JsonValue;
    context: RunContext;
  }): Promise<OracleResult>;
}

export interface HarnessAdapter {
  name: string;
  setup?(context: RunContext): Promise<void>;
  teardown?(context: RunContext): Promise<void>;
  actions: Record<string, HarnessAction>;
  inspectors: Record<string, HarnessInspector>;
  oracles?: Record<string, HarnessOracle>;
}

export class Registry<T> {
  private readonly items = new Map<string, T>();

  register(name: string, value: T): void {
    if (!/^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*)+$/.test(name)) {
      throw new Error(`Invalid registry name: ${name}`);
    }
    this.items.set(name, value);
  }

  get(name: string): T | undefined {
    return this.items.get(name);
  }

  has(name: string): boolean {
    return this.items.has(name);
  }

  names(): string[] {
    return [...this.items.keys()].sort();
  }
}

export class ActionRegistry extends Registry<HarnessAction> {}
export class InspectorRegistry extends Registry<HarnessInspector> {}
export class OracleRegistry extends Registry<HarnessOracle> {}
