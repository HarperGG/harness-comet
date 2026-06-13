import type { HarnessAdapter } from "@harness-comet/sdk";
import type { JsonValue } from "@harness-comet/schema";

function asObject(input: JsonValue): Record<string, JsonValue> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Input must be an object");
  }
  return input;
}

export function createMemoryAdapter(): HarnessAdapter {
  const store = new Map<string, JsonValue>();
  return {
    name: "memory",
    actions: {
      "memory.set": {
        async execute(input) {
          const object = asObject(input);
          const key = String(object.key);
          store.set(key, object.value ?? null);
          return { values: { [key]: object.value ?? null } };
        }
      },
      "memory.merge": {
        async execute(input) {
          const object = asObject(input);
          const key = String(object.key);
          const current = store.get(key);
          if (!current || typeof current !== "object" || Array.isArray(current)) {
            store.set(key, object.value ?? {});
          } else {
            store.set(key, {
              ...current,
              ...(asObject(object.value ?? {}) as Record<string, JsonValue>)
            });
          }
          return { values: { [key]: store.get(key) ?? null } };
        }
      },
      "memory.delete": {
        async execute(input) {
          const object = asObject(input);
          store.delete(String(object.key));
          return {};
        }
      }
    },
    inspectors: {
      "memory.get": {
        async inspect(input) {
          const object = asObject(input);
          return store.get(String(object.key)) ?? null;
        }
      },
      "memory.all": {
        async inspect() {
          return Object.fromEntries(store.entries()) as Record<string, JsonValue>;
        }
      }
    }
  };
}

export default createMemoryAdapter();
