// Results of scheduled runs that reached no one are posted into the Daisy chat,
// so someone without a chat app still sees what their job did, or why not.
import { beforeEach, describe, expect, it, vi } from "vitest";

const appendAssistantMessageToSessionTranscript = vi.hoisted(() => vi.fn());
vi.mock("../config/sessions/transcript.js", () => ({ appendAssistantMessageToSessionTranscript }));

import type { CronEvent } from "../cron/service.js";
import type { CronJob } from "../cron/types.js";
import {
  describeCronRunError,
  formatCronRunChatMessage,
  isUndeliveredCronRun,
  postUndeliveredCronRunToChat,
} from "./cron-chat-fallback.js";

function job(overrides: Partial<CronJob> = {}): CronJob {
  return {
    id: "job-1",
    name: "Atlas update",
    enabled: true,
    createdAtMs: 0,
    updatedAtMs: 0,
    schedule: { kind: "every", everyMs: 20 * 60_000 },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: { kind: "agentTurn", message: "Email Sam for an update" },
    delivery: { mode: "announce" },
    state: {},
    ...overrides,
  } as CronJob;
}

function finished(overrides: Partial<CronEvent> = {}): CronEvent {
  return {
    jobId: "job-1",
    action: "finished",
    status: "ok",
    summary: "Sent the update request to sam@example.com.",
    runAtMs: Date.UTC(2026, 9, 6, 12, 25),
    delivered: false,
    deliveryStatus: "not-delivered",
    ...overrides,
  };
}

const resolveCronAgent = () => ({ agentId: "main", cfg: {} as never });

beforeEach(() => {
  appendAssistantMessageToSessionTranscript.mockReset();
  appendAssistantMessageToSessionTranscript.mockResolvedValue({
    ok: true,
    sessionFile: "x.jsonl",
    messageId: "m-1",
  });
});

describe("scheduled run results in the chat", () => {
  it("posts a result no chat app carried", () => {
    expect(isUndeliveredCronRun(finished(), job())).toBe(true);
  });

  it("leaves results that were delivered, or never meant to be", () => {
    expect(isUndeliveredCronRun(finished({ delivered: true }), job())).toBe(false);
    expect(isUndeliveredCronRun(finished(), job({ delivery: { mode: "none" } }))).toBe(false);
    expect(isUndeliveredCronRun(finished({ deliveryStatus: "not-requested" }), job())).toBe(false);
  });

  it("leaves jobs that already run inside the chat", () => {
    expect(isUndeliveredCronRun(finished(), job({ sessionTarget: "main" }))).toBe(false);
  });

  it("says why a run stopped, and when the next one is", () => {
    const text = formatCronRunChatMessage(
      finished({
        status: "error",
        error: "cron: isolated agent setup timed out before runner start",
        summary: undefined,
        nextRunAtMs: Date.UTC(2026, 9, 6, 12, 45),
      }),
      job(),
    );
    expect(text).toContain("Atlas update** didn't finish");
    expect(text).toContain("couldn't get started in time");
    expect(text).toContain("Next run:");
  });

  it("puts engine errors into plain words", () => {
    expect(describeCronRunError("cron: job execution timed out")).toContain("time limit");
    expect(describeCronRunError(undefined)).toContain("Something went wrong");
  });

  it("writes the result into the job's own chat and shows it live", async () => {
    const broadcast = vi.fn();
    await postUndeliveredCronRunToChat({
      evt: finished(),
      job: job({ sessionKey: "agent:main:chat-42" }),
      resolveCronAgent,
      broadcast,
    });
    expect(appendAssistantMessageToSessionTranscript).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:chat-42",
        text: expect.stringContaining("Sent the update request"),
      }),
    );
    expect(broadcast).toHaveBeenCalledWith(
      "chat",
      expect.objectContaining({ sessionKey: "agent:main:chat-42", state: "final" }),
    );
  });

  it("uses the main chat for jobs made on the Jobs page", async () => {
    await postUndeliveredCronRunToChat({
      evt: finished(),
      job: job(),
      resolveCronAgent,
      broadcast: vi.fn(),
    });
    expect(appendAssistantMessageToSessionTranscript.mock.calls[0]?.[0].sessionKey).toBe(
      "agent:main:main",
    );
  });

  it("posts each run once", async () => {
    await postUndeliveredCronRunToChat({
      evt: finished(),
      job: job(),
      resolveCronAgent,
      broadcast: vi.fn(),
    });
    expect(appendAssistantMessageToSessionTranscript.mock.calls[0]?.[0].idempotencyKey).toBe(
      `cron-run:job-1:${Date.UTC(2026, 9, 6, 12, 25)}`,
    );
  });
});
