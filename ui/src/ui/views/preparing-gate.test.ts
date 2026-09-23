// The waiting screen used to show one line and a spinner for minutes, so people
// decided the app had frozen. It must say what it is actually doing.
import { describe, expect, it } from "vitest";
import { describePreparingStage } from "./login-gate.ts";

describe("what the waiting screen says", () => {
  it("says it is starting the engine first", () => {
    const copy = describePreparingStage({ stage: "starting", elapsedMs: 0 });
    expect(copy.slow).toBe(false);
    expect(copy.title.toLowerCase()).toContain("starting");
    expect(copy.summary).toBeTruthy();
  });

  it("moves on to loading once the engine answers", () => {
    const starting = describePreparingStage({ stage: "starting", elapsedMs: 0 });
    const loading = describePreparingStage({ stage: "loading", elapsedMs: 0 });
    expect(loading.title).not.toBe(starting.title);
    expect(loading.summary).not.toBe(starting.summary);
  });

  it("explains itself when the first start runs long", () => {
    const quick = describePreparingStage({ stage: "starting", elapsedMs: 3_000 });
    const slow = describePreparingStage({ stage: "starting", elapsedMs: 45_000 });
    expect(quick.slow).toBe(false);
    expect(slow.slow).toBe(true);
    expect(slow.summary).not.toBe(quick.summary);
    // It should name the real reason rather than apologise vaguely.
    expect(slow.summary.toLowerCase()).toContain("first");
  });
});
