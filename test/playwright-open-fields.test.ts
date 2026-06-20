import { describe, expect, it } from "vitest";
import {
  parsePlaywrightOperations,
  parseQuotedBooleanField,
  parseQuotedWordField
} from "../packages/comet-adapter/src/playwright-open-fields.js";

describe("Playwright Open decision fields", () => {
  it("accepts quoted values and trailing comments", () => {
    const content = `enabled: "true" # confirmed
confirmedBy: 'user'
operation: "create" # new test`;

    expect(parseQuotedBooleanField(content, "enabled")).toBe(true);
    expect(parseQuotedWordField(content, "confirmedBy")).toBe("user");
    expect(parsePlaywrightOperations(content)).toEqual(["create"]);
  });

  it("accepts list-prefixed operation fields", () => {
    expect(parsePlaywrightOperations("- operation: update")).toEqual(["update"]);
  });

  it("does not parse malformed operation fields", () => {
    expect(parsePlaywrightOperations("operation = create")).toEqual([]);
  });
});
