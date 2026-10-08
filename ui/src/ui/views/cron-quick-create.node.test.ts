// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  applyCronDraftToQuickCreate,
  draftToCronFormPatch,
  type CronQuickCreateDraft,
} from "./cron-quick-create.ts";

function createDraft(overrides: Partial<CronQuickCreateDraft> = {}): CronQuickCreateDraft {
  return {
    prompt: "Check inbox",
    name: "Inbox check",
    schedulePreset: "every-morning",
    deliveryPreset: "notify",
    ...overrides,
  };
}

describe("cron quick create", () => {
  it("sets a valid scheduleAt for one-time presets", () => {
    const patch = draftToCronFormPatch(createDraft({ schedulePreset: "once" }));

    expect(patch.scheduleKind).toBe("at");
    expect(patch.deleteAfterRun).toBe(true);
    expect(typeof patch.scheduleAt).toBe("string");
    expect(Date.parse(String(patch.scheduleAt))).not.toBeNaN();
  });

  it("clears deleteAfterRun and scheduleAt for recurring presets", () => {
    const patch = draftToCronFormPatch(createDraft({ schedulePreset: "weekly" }));

    expect(patch.scheduleKind).toBe("cron");
    expect(patch.cronExpr).toBe("0 9 * * 1");
    expect(patch.deleteAfterRun).toBe(false);
    expect(patch.scheduleAt).toBe("");
  });

  it("keeps notify preset announce-capable by targeting an isolated session", () => {
    const patch = draftToCronFormPatch(createDraft({ deliveryPreset: "notify" }));

    expect(patch.sessionTarget).toBe("isolated");
    expect(patch.deliveryMode).toBe("announce");
    expect(patch.wakeMode).toBe("now");
  });

  // The sentence that became an hourly job: the presets had no 20-minute
  // choice and no start time, and the timing stayed inside the task.
  it("splits a sentence into the task and a custom schedule", () => {
    const draft = applyCronDraftToQuickCreate(
      createDraft({
        name: "",
        prompt: "every 20 min email sam@example.com for an update, start 4:05PM today",
      }),
      {
        name: "Atlas update",
        task: "Email sam@example.com for an update.",
        schedule: { kind: "every", amount: 20, unit: "minutes", startAt: "2026-10-06T16:05" },
      },
    );
    expect(draft).toMatchObject({
      name: "Atlas update",
      prompt: "Email sam@example.com for an update.",
      schedulePreset: "custom",
      custom: { kind: "every", amount: "20", unit: "minutes", startAt: "2026-10-06T16:05" },
    });
    expect(draft.splitFrom).toContain("every 20 min");

    const patch = draftToCronFormPatch(draft);
    expect(patch).toMatchObject({
      scheduleKind: "every",
      everyAmount: "20",
      everyUnit: "minutes",
      everyStartAt: "2026-10-06T16:05",
      payloadText: "Email sam@example.com for an update.",
    });
  });

  it("keeps a name the user already typed", () => {
    const draft = applyCronDraftToQuickCreate(createDraft({ name: "My check" }), {
      name: "Drafted",
      task: "Check inbox",
      schedule: { kind: "cron", expr: "0 9 * * 1-5" },
    });
    expect(draft.name).toBe("My check");
    expect(draftToCronFormPatch(draft)).toMatchObject({
      scheduleKind: "cron",
      cronExpr: "0 9 * * 1-5",
    });
  });

  // "Silent" used to target the main chat, which the scheduler allows only for
  // reminder notes, so every task saved with it was refused.
  it("runs a silent task on its own, the way the scheduler accepts", () => {
    const patch = draftToCronFormPatch(createDraft({ deliveryPreset: "silent" }));

    expect(patch.payloadKind).toBe("agentTurn");
    expect(patch.sessionTarget).toBe("isolated");
    expect(patch.deliveryMode).toBe("none");
  });
});
