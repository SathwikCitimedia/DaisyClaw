// Logger settings tests cover normalization of logger configuration values.
import { describe, expect, it } from "vitest";
import { testApi } from "./logger.js";

describe("shouldSkipMutatingLoggingConfigRead", () => {
  it("matches config schema and validate invocations", () => {
    expect(
      testApi.shouldSkipMutatingLoggingConfigRead(["node", "daisyclaw", "config", "schema"]),
    ).toBe(true);
    expect(
      testApi.shouldSkipMutatingLoggingConfigRead(["node", "daisyclaw", "config", "validate"]),
    ).toBe(true);
  });

  it("handles root flags before config validate", () => {
    expect(
      testApi.shouldSkipMutatingLoggingConfigRead([
        "node",
        "daisyclaw",
        "--profile",
        "work",
        "--no-color",
        "config",
        "validate",
        "--json",
      ]),
    ).toBe(true);
  });

  it("does not match other commands", () => {
    expect(
      testApi.shouldSkipMutatingLoggingConfigRead(["node", "daisyclaw", "config", "get", "foo"]),
    ).toBe(false);
    expect(testApi.shouldSkipMutatingLoggingConfigRead(["node", "daisyclaw", "status"])).toBe(false);
  });
});
