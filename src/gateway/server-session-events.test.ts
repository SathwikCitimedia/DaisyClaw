import { describe, expect, it, vi } from "vitest";
import type { ChatAbortControllerEntry } from "./chat-abort.js";

const previousAnswerRow = {
  key: "agent:main:main",
  kind: "direct",
  sessionId: "sess-1",
  updatedAt: 5_000,
  status: "done",
  startedAt: 1_000,
  endedAt: 5_000,
  runtimeMs: 4_000,
};

vi.mock("./session-utils.js", () => ({
  attachDaisyClawTranscriptMeta: (message: unknown) => message,
  loadGatewaySessionRow: () => ({ ...previousAnswerRow }),
  loadSessionEntry: () => ({ entry: undefined, storePath: "" }),
  readSessionMessageCountAsync: async () => 1,
}));
vi.mock("./chat-display-projection.js", () => ({
  projectChatDisplayMessage: (message: unknown) => message,
}));
vi.mock("../config/io.js", () => ({ getRuntimeConfig: () => ({}) }));

const { createTranscriptUpdateBroadcastHandler } = await import("./server-session-events.js");

function runsWith(startedAtMs: number | null) {
  const runs = new Map<string, ChatAbortControllerEntry>();
  if (startedAtMs !== null) {
    runs.set("run-now", {
      controller: new AbortController(),
      sessionId: "sess-1",
      sessionKey: "agent:main:main",
      startedAtMs,
      expiresAtMs: startedAtMs + 60_000,
    } as ChatAbortControllerEntry);
  }
  return runs;
}

async function broadcastUserMessage(chatAbortControllers: Map<string, ChatAbortControllerEntry>) {
  const broadcastToConnIds = vi.fn();
  const handle = createTranscriptUpdateBroadcastHandler({
    broadcastToConnIds,
    sessionEventSubscribers: { getAll: () => new Set(["conn-1"]) },
    sessionMessageSubscribers: { get: () => new Set<string>() },
    chatAbortControllers,
  });
  handle({
    sessionKey: "agent:main:main",
    sessionFile: "sess-1.jsonl",
    message: { role: "user", content: "research this further" },
    messageSeq: 3,
  } as never);
  await vi.waitFor(() => expect(broadcastToConnIds).toHaveBeenCalled());
  return broadcastToConnIds.mock.calls[0]?.[1] as {
    status?: string;
    endedAt?: number;
    session?: { status?: string };
  };
}

describe("session message events while a reply is running", () => {
  // Saving the user's message announces the session with its saved status,
  // which is still the previous answer's "done": the screen took that as this
  // reply finishing and hid its progress.
  it("report the session as running, not the previous answer's done", async () => {
    const payload = await broadcastUserMessage(runsWith(10_000));

    expect(payload.status).toBe("running");
    expect(payload.endedAt).toBeUndefined();
    expect(payload.session?.status).toBe("running");
  });

  it("keep the saved status when nothing is running", async () => {
    const payload = await broadcastUserMessage(runsWith(null));

    expect(payload.status).toBe("done");
    expect(payload.endedAt).toBe(5_000);
  });
});
