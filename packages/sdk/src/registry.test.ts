import { describe, expect, it } from "vitest";
import { ActionRegistry } from "./index.js";

describe("Registry", () => {
  it("stores names in stable order and rejects invalid names", () => {
    const registry = new ActionRegistry();
    registry.register("memory.set", { execute: async () => ({}) });
    registry.register("page.goto", { execute: async () => ({}) });
    expect(registry.names()).toEqual(["memory.set", "page.goto"]);
    expect(() => registry.register("bad", { execute: async () => ({}) })).toThrow();
  });
});
