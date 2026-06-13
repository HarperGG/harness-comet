import { describe, expect, it } from "vitest";
import { redactHeaders } from "./index.js";

describe("redactHeaders", () => {
  it("redacts sensitive request headers", () => {
    expect(
      redactHeaders({ authorization: "Bearer secret", "x-api-key": "secret", accept: "json" })
    ).toEqual({
      authorization: "[REDACTED]",
      "x-api-key": "[REDACTED]",
      accept: "json"
    });
  });
});
