// Verifies cron retention schema parsing and defaults.
import { describe, expect, it } from "vitest";
import { DaisyClawSchema } from "./zod-schema.js";

describe("DaisyClawSchema cron retention and run-log validation", () => {
  it("accepts valid cron.sessionRetention and runLog values", () => {
    const result = DaisyClawSchema.safeParse({
      cron: {
        sessionRetention: "1h30m",
        runLog: {
          maxBytes: "5mb",
          keepLines: 2500,
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid cron.sessionRetention", () => {
    expect(() =>
      DaisyClawSchema.parse({
        cron: {
          sessionRetention: "abc",
        },
      }),
    ).toThrow(/sessionRetention|duration/i);
  });

  it("rejects invalid cron.runLog.maxBytes", () => {
    expect(() =>
      DaisyClawSchema.parse({
        cron: {
          runLog: {
            maxBytes: "wat",
          },
        },
      }),
    ).toThrow(/runLog|maxBytes|size/i);
  });
});
