import { z } from "zod";
import type { Difference, JsonValue } from "@hapergg/harness-comet-schema";
import type { HarnessOracle } from "@hapergg/harness-comet-sdk";

function stableJson(value: JsonValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
    .join(",")}}`;
}

function diffEquals(actual: JsonValue, expected: JsonValue, path = "$"): Difference[] {
  if (stableJson(actual) === stableJson(expected)) return [];
  if (typeof actual !== typeof expected || Array.isArray(actual) !== Array.isArray(expected)) {
    return [{ path, type: "type-mismatch", expected, actual }];
  }
  if (isJsonObject(actual) && isJsonObject(expected)) {
    const diffs: Difference[] = [];
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    for (const key of [...keys].sort()) {
      if (!(key in actual))
        diffs.push({ path: `${path}.${key}`, type: "missing", expected: expected[key] });
      else if (!(key in expected))
        diffs.push({ path: `${path}.${key}`, type: "unexpected", actual: actual[key] });
      else diffs.push(...diffEquals(actual[key], expected[key], `${path}.${key}`));
    }
    return diffs;
  }
  return [{ path, type: "value-mismatch", expected, actual }];
}

function isSubset(actual: JsonValue, expected: JsonValue): boolean {
  if (stableJson(actual) === stableJson(expected)) return true;
  if (!isJsonObject(actual) || !isJsonObject(expected)) return false;
  return Object.entries(expected).every(
    ([key, value]) => key in actual && isSubset(actual[key], value)
  );
}

function isJsonObject(value: JsonValue): value is Record<string, JsonValue> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function createGenericOracles(): Record<string, HarnessOracle> {
  return {
    "value.equals": {
      async evaluate({ actual, expected }) {
        const differences = diffEquals(actual, expected);
        return { passed: differences.length === 0, differences };
      }
    },
    "value.contains": {
      async evaluate({ actual, expected }) {
        const passed =
          typeof actual === "string"
            ? actual.includes(String(expected))
            : Array.isArray(actual)
              ? actual.some((item) => stableJson(item) === stableJson(expected))
              : false;
        return {
          passed,
          differences: passed ? [] : [{ path: "$", type: "value-mismatch", expected, actual }]
        };
      }
    },
    "json.equals": {
      async evaluate({ actual, expected }) {
        const differences = diffEquals(actual, expected);
        return { passed: differences.length === 0, differences };
      }
    },
    "json.subset": {
      async evaluate({ actual, expected }) {
        const passed = isSubset(actual, expected);
        return {
          passed,
          differences: passed ? [] : [{ path: "$", type: "value-mismatch", expected, actual }]
        };
      }
    },
    "json.schema": {
      async evaluate({ actual, expected }) {
        const schema = z.object({});
        if (!expected || typeof expected !== "object" || Array.isArray(expected)) {
          return {
            passed: false,
            differences: [{ path: "$", type: "schema-mismatch", expected, actual }]
          };
        }
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const [key, typeName] of Object.entries(expected)) {
          shape[key] =
            typeName === "string"
              ? z.string()
              : typeName === "number"
                ? z.number()
                : typeName === "boolean"
                  ? z.boolean()
                  : z.any();
        }
        const result = schema.extend(shape).safeParse(actual);
        return {
          passed: result.success,
          differences: result.success
            ? []
            : [{ path: "$", type: "schema-mismatch", expected, actual }]
        };
      }
    },
    "array.contains": {
      async evaluate({ actual, expected }) {
        const passed =
          Array.isArray(actual) && actual.some((item) => stableJson(item) === stableJson(expected));
        return {
          passed,
          differences: passed ? [] : [{ path: "$", type: "missing", expected, actual }]
        };
      }
    },
    "boolean.isTrue": {
      async evaluate({ actual }) {
        return {
          passed: actual === true,
          differences:
            actual === true ? [] : [{ path: "$", type: "value-mismatch", expected: true, actual }]
        };
      }
    },
    "boolean.isFalse": {
      async evaluate({ actual }) {
        return {
          passed: actual === false,
          differences:
            actual === false ? [] : [{ path: "$", type: "value-mismatch", expected: false, actual }]
        };
      }
    }
  };
}
