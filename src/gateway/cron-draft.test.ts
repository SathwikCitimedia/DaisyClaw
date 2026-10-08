// One sentence becomes a job the form can show for review: the task on its own
// and the schedule in the schedule fields, never mixed together again.
import { describe, expect, it, vi } from "vitest";
import {
  draftCronJobFromText,
  parseCronDraftWithRules,
  parseModelDraft,
  readDraftSchedule,
} from "./cron-draft.js";

const SENTENCE =
  "for every 20 min send a email to sam@example.com, regarding update of Atlas project and ask him update for every 20 min until i stop , start first mail @4:05PM today";

describe("drafting a job from one sentence", () => {
  it("reads the model's job, keeping only schedules the form can hold", () => {
    const draft = parseModelDraft(
      '```json\n{"name":"Atlas update","task":"Email sam@example.com asking for an update on the Atlas project.","schedule":{"kind":"every","amount":20,"unit":"minutes","startAt":"2026-10-06T16:05"}}\n```',
    );
    expect(draft).toEqual({
      name: "Atlas update",
      task: "Email sam@example.com asking for an update on the Atlas project.",
      schedule: { kind: "every", amount: 20, unit: "minutes", startAt: "2026-10-06T16:05" },
    });
  });

  it("rejects schedules that are not real", () => {
    expect(readDraftSchedule({ kind: "every", amount: 0, unit: "minutes" })).toBeNull();
    expect(readDraftSchedule({ kind: "every", amount: 5, unit: "weeks" })).toBeNull();
    expect(readDraftSchedule({ kind: "cron", expr: "not a cron" })).toBeNull();
    expect(readDraftSchedule({ kind: "at", at: "tomorrow" })).toBeNull();
    expect(readDraftSchedule({ kind: "cron", expr: "0 9 * * 1-5" })).toEqual({
      kind: "cron",
      expr: "0 9 * * 1-5",
    });
  });

  it("splits the schedule out of a sentence with plain rules", () => {
    const draft = parseCronDraftWithRules(SENTENCE, new Date(2026, 9, 6, 15, 58));
    expect(draft?.schedule).toEqual({
      kind: "every",
      amount: 20,
      unit: "minutes",
      startAt: "2026-10-06T16:05",
    });
    expect(draft?.task).toContain("sam@example.com");
    expect(draft?.task).not.toMatch(/every 20|until i stop|4:05|today/i);
  });

  it("reads a daily time as a fixed daily schedule", () => {
    expect(parseCronDraftWithRules("every day at 9am summarise my inbox")?.schedule).toEqual({
      kind: "cron",
      expr: "0 9 * * *",
    });
  });

  it("asks the user's model first", async () => {
    const generate = vi.fn(
      async () =>
        '{"name":"Inbox summary","task":"Summarise my inbox.","schedule":{"kind":"cron","expr":"0 9 * * *"}}',
    );
    const result = await draftCronJobFromText({
      text: "every morning at 9 summarise my inbox",
      now: "2026-10-06T15:58 Tuesday",
      timeZone: "Asia/Kolkata",
      cfg: {} as never,
      generate: generate as never,
    });
    expect(result).toMatchObject({ ok: true, source: "model", draft: { name: "Inbox summary" } });
    const call = generate.mock.calls[0] as unknown as [{ prompt: string }];
    expect(call[0].prompt).toContain("2026-10-06T15:58 Tuesday");
  });

  it("falls back to the rules when the model cannot help", async () => {
    const result = await draftCronJobFromText({
      text: SENTENCE,
      now: "2026-10-06T15:58",
      cfg: {} as never,
      generate: (async () => null) as never,
    });
    expect(result).toMatchObject({
      ok: true,
      source: "rules",
      draft: { schedule: { kind: "every", amount: 20, unit: "minutes" } },
    });
  });

  it("says what to add when it cannot tell when to run", async () => {
    const result = await draftCronJobFromText({
      text: "email Sam",
      now: "2026-10-06T15:58",
      cfg: {} as never,
      generate: (async () => "I'm not sure") as never,
    });
    expect(result).toMatchObject({ ok: false });
    expect(result.ok ? "" : result.reason).toContain("every 20 minutes");
  });
});
