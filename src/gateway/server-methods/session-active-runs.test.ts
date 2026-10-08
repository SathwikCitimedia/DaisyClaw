import { describe, expect, it } from "vitest";
import type { ChatAbortControllerEntry } from "../chat-abort.js";
import { hasTrackedActiveSessionRun, withTrackedActiveSessionRun } from "./session-active-runs.js";

function contextWithRun(run: Partial<ChatAbortControllerEntry> | null) {
  const chatAbortControllers = new Map<string, ChatAbortControllerEntry>();
  if (run) {
    chatAbortControllers.set("run-1", {
      controller: new AbortController(),
      sessionId: "sess-1",
      sessionKey: "agent:main:main",
      startedAtMs: 10_000,
      expiresAtMs: 99_000,
      ...run,
    } as ChatAbortControllerEntry);
  }
  return { chatAbortControllers };
}

const keys = { requestedKey: "agent:main:main", canonicalKey: "agent:main:main" };

describe("withTrackedActiveSessionRun", () => {
  // A new run's lifecycle status is saved a beat after it starts. Until then
  // the row still says "done" from the previous answer, which clients trust
  // over the live flag and so stopped showing the reply's progress.
  it("reports a run in flight as running over the previous answer's done", () => {
    const row = withTrackedActiveSessionRun(
      { status: "done", startedAt: 1_000, endedAt: 5_000, runtimeMs: 4_000 },
      { context: contextWithRun({}), ...keys },
    );

    expect(row).toEqual({
      status: "running",
      hasActiveRun: true,
      startedAt: 10_000,
      endedAt: undefined,
      runtimeMs: undefined,
    });
  });

  it("keeps a finished status written after the run began", () => {
    const row = withTrackedActiveSessionRun(
      { status: "done", startedAt: 10_000, endedAt: 12_000 },
      { context: contextWithRun({}), ...keys },
    );

    expect(row).toMatchObject({ status: "done", hasActiveRun: true, endedAt: 12_000 });
  });

  it("leaves rows alone when nothing is running", () => {
    const row = withTrackedActiveSessionRun(
      { status: "done", endedAt: 5_000 },
      { context: contextWithRun(null), ...keys },
    );

    expect(row).toEqual({ status: "done", endedAt: 5_000, hasActiveRun: false });
    expect(hasTrackedActiveSessionRun({ context: contextWithRun(null), ...keys })).toBe(false);
  });

  it("ignores runs hidden from the Control UI or already marked finished", () => {
    for (const hidden of [{ controlUiVisible: false }, { projectSessionActive: false }]) {
      const row = withTrackedActiveSessionRun(
        { status: "done", endedAt: 5_000 },
        { context: contextWithRun(hidden), ...keys },
      );
      expect(row).toMatchObject({ status: "done", hasActiveRun: false });
    }
  });

  it("does not change the row it was given", () => {
    const original = { status: "done", endedAt: 5_000 };
    withTrackedActiveSessionRun(original, { context: contextWithRun({}), ...keys });

    expect(original).toEqual({ status: "done", endedAt: 5_000 });
  });
});
