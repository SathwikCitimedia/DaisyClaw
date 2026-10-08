// The Jobs page says what a job will do in plain words, notices when a task's
// text asks for a different interval than its schedule, and explains failed
// runs without engine jargon.
import { describe, expect, it } from "vitest";
import { DEFAULT_CRON_FORM } from "./app-defaults.ts";
import {
  describeCronExpression,
  describeCronForm,
  describeCronRunError,
  detectEveryInText,
  findScheduleMismatch,
  formatLocalStart,
} from "./cron-describe.ts";
import type { CronFormState } from "./ui-types.ts";

function form(overrides: Partial<CronFormState> = {}): CronFormState {
  return { ...DEFAULT_CRON_FORM, ...overrides };
}

describe("cron descriptions", () => {
  it("finds the interval a task's text asks for", () => {
    expect(detectEveryInText("for every 20 min send an email")).toEqual({
      amount: 20,
      unit: "minutes",
    });
    expect(detectEveryInText("every 2 hours check the build")).toEqual({
      amount: 2,
      unit: "hours",
    });
    expect(detectEveryInText("summarise my inbox")).toBeNull();
  });

  // The job that started this: the text said every 20 minutes, the schedule
  // said every hour, and the job ran hourly.
  it("notices a task asking for a different interval than its schedule", () => {
    expect(
      findScheduleMismatch(
        form({
          payloadText: "for every 20 min send an email",
          scheduleKind: "every",
          everyAmount: "1",
          everyUnit: "hours",
        }),
      ),
    ).toEqual({ amount: 20, unit: "minutes" });
    expect(
      findScheduleMismatch(
        form({
          payloadText: "every 20 min send an email",
          scheduleKind: "every",
          everyAmount: "20",
          everyUnit: "minutes",
        }),
      ),
    ).toBeNull();
  });

  it("says when, what and where results go in one line", () => {
    const line = describeCronForm(
      form({
        scheduleKind: "every",
        everyAmount: "20",
        everyUnit: "minutes",
        payloadText: "Email sam@example.com for an Atlas update.",
        deliveryMode: "announce",
      }),
      false,
    );
    expect(line).toBe(
      "Every 20 minutes · Email sam@example.com for an Atlas update. · Results in your Daisy chat",
    );
  });

  it("names the start of a repeating job relative to today", () => {
    const now = new Date(2026, 9, 6, 15, 58);
    expect(formatLocalStart("2026-10-06T16:05", now)).toMatch(/^today /);
    expect(formatLocalStart("2026-10-07T09:00", now)).toMatch(/^tomorrow /);
  });

  it("reads common fixed schedules in words", () => {
    expect(describeCronExpression("0 9 * * 1-5")).toMatch(/^weekdays at /);
    expect(describeCronExpression("0 8 * * *")).toMatch(/^every day at /);
    expect(describeCronExpression("*/5 * * * *")).toContain("*/5 * * * *");
  });

  it("explains failed runs in plain words", () => {
    expect(
      describeCronRunError("cron: isolated agent setup timed out before runner start"),
    ).toContain("couldn't get started in time");
    expect(describeCronRunError("cron: job execution timed out")).toContain("time limit");
    expect(describeCronRunError("Something specific broke")).toBe("Something specific broke");
  });
});
