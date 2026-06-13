import { describe, expect, it } from "vitest";
import { createMemoryAdapter } from "./index.js";

describe("memory adapter", () => {
  it("sets and reads values", async () => {
    const adapter = createMemoryAdapter();
    await adapter.actions["memory.set"].execute({ key: "todo", value: "Write PRD" }, {} as never);
    await expect(
      adapter.inspectors["memory.get"].inspect({ key: "todo" }, {} as never)
    ).resolves.toBe("Write PRD");
  });
});
