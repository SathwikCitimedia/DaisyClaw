/**
 * Tests ChatGPT-style message-edit forking: sessions.forkFromMessage rewrites
 * the session to a forked transcript that ends just before the edited user
 * message, leaving the source transcript untouched.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayRequestContext, RespondFn } from "./types.js";

const loadSessionEntryMock = vi.fn();
const updateSessionStoreMock = vi.fn();
const emitSessionsChangedMock = vi.fn();

vi.mock("../session-utils.js", async () => {
  const actual = await vi.importActual<typeof import("../session-utils.js")>("../session-utils.js");
  return {
    ...actual,
    loadSessionEntry: (...args: unknown[]) => loadSessionEntryMock(...args),
  };
});

vi.mock("../../config/sessions.js", async () => {
  const actual = await vi.importActual<typeof import("../../config/sessions.js")>(
    "../../config/sessions.js",
  );
  return {
    ...actual,
    updateSessionStore: (...args: unknown[]) => updateSessionStoreMock(...args),
  };
});

vi.mock("./session-change-event.js", () => ({
  emitSessionsChanged: (...args: unknown[]) => emitSessionsChangedMock(...args),
}));

import { sessionsHandlers } from "./sessions.js";

const SOURCE_SESSION_ID = "src-sess";

let tmpDir = "";
let sourceFile = "";
let storePath = "";

function writeSourceTranscript(lines: object[]): void {
  fs.writeFileSync(
    sourceFile,
    `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`,
    "utf-8",
  );
}

function transcriptEntry(params: {
  id: string;
  parentId: string | null;
  role?: "user" | "assistant";
  text?: string;
}): object {
  return {
    type: "message",
    id: params.id,
    parentId: params.parentId,
    timestamp: "2026-07-28T10:00:01.000Z",
    message:
      params.role === "assistant"
        ? {
            role: "assistant",
            content: [{ type: "text", text: params.text ?? "answer" }],
          }
        : { role: "user", content: params.text ?? "question", timestamp: 1 },
  };
}

function writeDefaultTranscript(): void {
  writeSourceTranscript([
    {
      type: "session",
      version: 3,
      id: SOURCE_SESSION_ID,
      timestamp: "2026-07-28T10:00:00.000Z",
      cwd: tmpDir,
    },
    {
      type: "model_change",
      id: "e1",
      parentId: null,
      timestamp: "2026-07-28T10:00:00.500Z",
      provider: "litellm",
      modelId: "claude-sonnet-4-5",
    },
    transcriptEntry({
      id: "e2",
      parentId: "e1",
      role: "user",
      text: "first question",
    }),
    transcriptEntry({
      id: "e3",
      parentId: "e2",
      role: "assistant",
      text: "first answer",
    }),
    transcriptEntry({
      id: "e4",
      parentId: "e3",
      role: "user",
      text: "second question",
    }),
    transcriptEntry({
      id: "e5",
      parentId: "e4",
      role: "assistant",
      text: "second answer",
    }),
  ]);
}

function createContext(): GatewayRequestContext {
  return {
    chatAbortControllers: new Map(),
    getRuntimeConfig: () => ({}),
  } as unknown as GatewayRequestContext;
}

async function callForkFromMessage(params: Record<string, unknown>): Promise<{
  respond: ReturnType<typeof vi.fn>;
}> {
  const respond = vi.fn();
  await sessionsHandlers["sessions.forkFromMessage"]({
    req: { id: "req-fork" } as never,
    params,
    respond: respond as unknown as RespondFn,
    context: createContext(),
    client: null,
    isWebchatConnect: () => false,
  });
  return { respond };
}

function readTranscriptIds(file: string): string[] {
  return fs
    .readFileSync(file, "utf-8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as { id?: string })
    .flatMap((record) => (typeof record.id === "string" ? [record.id] : []));
}

function capturedStoreEntry(): { sessionId: string; sessionFile: string } {
  expect(updateSessionStoreMock).toHaveBeenCalledTimes(1);
  const mutate = updateSessionStoreMock.mock.calls[0]?.[1] as (
    store: Record<string, unknown>,
  ) => void;
  const store: Record<string, unknown> = {};
  mutate(store);
  return store["main"] as { sessionId: string; sessionFile: string };
}

describe("sessions.forkFromMessage", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "daisyclaw-fork-test-"));
    sourceFile = path.join(tmpDir, `${SOURCE_SESSION_ID}.jsonl`);
    storePath = path.join(tmpDir, "sessions.json");
    loadSessionEntryMock.mockReset();
    updateSessionStoreMock.mockReset();
    emitSessionsChangedMock.mockReset();
    loadSessionEntryMock.mockImplementation(() => ({
      cfg: {},
      storePath,
      store: {},
      canonicalKey: "main",
      entry: {
        sessionId: SOURCE_SESSION_ID,
        sessionFile: sourceFile,
        updatedAt: 0,
      },
    }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("forks the session so history ends just before the edited user message", async () => {
    writeDefaultTranscript();
    const { respond } = await callForkFromMessage({
      key: "main",
      messageId: "e4",
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        key: "main",
        forkedFromSessionId: SOURCE_SESSION_ID,
        forkedAtMessageId: "e4",
      }),
      undefined,
    );

    const nextEntry = capturedStoreEntry();
    expect(nextEntry.sessionId).not.toBe(SOURCE_SESSION_ID);
    expect(fs.existsSync(nextEntry.sessionFile)).toBe(true);

    const forkedIds = readTranscriptIds(nextEntry.sessionFile);
    expect(forkedIds).toContain("e1");
    expect(forkedIds).toContain("e2");
    expect(forkedIds).toContain("e3");
    expect(forkedIds).not.toContain("e4");
    expect(forkedIds).not.toContain("e5");

    // The source transcript is never modified — the fork is non-destructive.
    expect(readTranscriptIds(sourceFile)).toEqual(
      expect.arrayContaining(["e1", "e2", "e3", "e4", "e5"]),
    );
    expect(emitSessionsChangedMock).toHaveBeenCalledTimes(1);
  });

  it("forks to a header-only transcript when editing the first entry", async () => {
    writeSourceTranscript([
      {
        type: "session",
        version: 3,
        id: SOURCE_SESSION_ID,
        timestamp: "2026-07-28T10:00:00.000Z",
        cwd: tmpDir,
      },
      transcriptEntry({
        id: "e1",
        parentId: null,
        role: "user",
        text: "only question",
      }),
      transcriptEntry({
        id: "e2",
        parentId: "e1",
        role: "assistant",
        text: "only answer",
      }),
    ]);
    const { respond } = await callForkFromMessage({
      key: "main",
      messageId: "e1",
    });

    expect(respond).toHaveBeenCalledWith(true, expect.objectContaining({ ok: true }), undefined);
    const nextEntry = capturedStoreEntry();
    expect(readTranscriptIds(nextEntry.sessionFile)).not.toContain("e1");
    const lines = fs
      .readFileSync(nextEntry.sessionFile, "utf-8")
      .split(/\r?\n/)
      .filter((line) => line.trim());
    expect(lines).toHaveLength(1);
    expect((JSON.parse(lines[0]) as { type?: string }).type).toBe("session");
  });

  it("forks at the most recent user message on the active branch with lastUser", async () => {
    writeDefaultTranscript();
    const { respond } = await callForkFromMessage({ key: "main", lastUser: true });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ ok: true, forkedAtMessageId: "e4" }),
      undefined,
    );
    const nextEntry = capturedStoreEntry();
    const forkedIds = readTranscriptIds(nextEntry.sessionFile);
    expect(forkedIds).toContain("e3");
    expect(forkedIds).not.toContain("e4");
    expect(forkedIds).not.toContain("e5");
  });

  it("rejects forking at a non-user message", async () => {
    writeDefaultTranscript();
    const { respond } = await callForkFromMessage({
      key: "main",
      messageId: "e3",
    });

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("does not reference a user message"),
      }),
    );
    expect(updateSessionStoreMock).not.toHaveBeenCalled();
  });

  it("rejects unknown message ids", async () => {
    writeDefaultTranscript();
    const { respond } = await callForkFromMessage({
      key: "main",
      messageId: "missing",
    });

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        message: expect.stringContaining("message not found"),
      }),
    );
    expect(updateSessionStoreMock).not.toHaveBeenCalled();
  });
});
