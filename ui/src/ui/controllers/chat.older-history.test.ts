/* @vitest-environment jsdom */

import { describe, expect, it, vi } from "vitest";
import { hasOlderChatHistory, loadOlderChatHistory } from "./chat.ts";

type Call = { method: string; params: Record<string, unknown> };

/** Long enough that two "load older" steps are still short of the whole thing. */
const CONVERSATION_LENGTH = 900;

function createState(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const state = {
    client: {
      request: vi.fn(async (method: string, params: Record<string, unknown>) => {
        calls.push({ method, params });
        const limit = Number(params.limit ?? 0);
        // The gateway answers with the most recent `limit` messages; this stub
        // pretends the conversation holds CONVERSATION_LENGTH of them.
        const available = Math.min(CONVERSATION_LENGTH, limit);
        return {
          messages: Array.from({ length: available }, (_, i) => ({
            role: "user",
            content: String(i),
          })),
        };
      }),
    },
    connected: true,
    sessionKey: "main",
    chatMessages: [],
    chatLoading: false,
    chatLoadingStartedAt: null,
    chatToolMessages: [],
    chatStreamSegments: [],
    ...overrides,
  } as unknown as Parameters<typeof loadOlderChatHistory>[0];
  return { state, calls };
}

describe("older chat history", () => {
  it("assumes more history exists until the gateway returns a short page", () => {
    const { state } = createState();
    expect(hasOlderChatHistory(state)).toBe(true);
  });

  it("asks for a bigger page each time and keeps the limit with its session", async () => {
    const { state, calls } = createState();
    await loadOlderChatHistory(state);
    const first = calls.find((call) => call.method.startsWith("chat."));
    expect(Number(first?.params.limit)).toBe(300);

    await loadOlderChatHistory(state);
    const limits = calls
      .filter((call) => call.method.startsWith("chat."))
      .map((call) => Number(call.params.limit));
    expect(limits).toEqual([300, 500]);

    // A different session starts from the small default again.
    (state as unknown as { sessionKey: string }).sessionKey = "other";
    expect(hasOlderChatHistory(state)).toBe(true);
    await loadOlderChatHistory(state);
    const afterSwitch = calls
      .filter((call) => call.method.startsWith("chat."))
      .map((call) => Number(call.params.limit));
    expect(afterSwitch[afterSwitch.length - 1]).toBe(300);
  });

  it("stops offering older messages once the whole conversation arrives", async () => {
    const { state } = createState();
    // Keep pressing "load earlier" exactly as the transcript does, until the
    // control stops being offered. It must stop: the conversation is finite.
    let steps = 0;
    while (hasOlderChatHistory(state) && steps < 20) {
      await loadOlderChatHistory(state);
      steps += 1;
    }
    expect(hasOlderChatHistory(state)).toBe(false);
    expect(steps).toBeLessThan(20);
    const before = (state as unknown as { chatHistoryRequestLimit?: number })
      .chatHistoryRequestLimit;
    await loadOlderChatHistory(state);
    expect((state as unknown as { chatHistoryRequestLimit?: number }).chatHistoryRequestLimit).toBe(
      before,
    );
  });
});
