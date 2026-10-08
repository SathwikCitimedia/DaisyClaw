import { describe, expect, it } from "vitest";
import type { SessionEntry } from "../config/sessions/types.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import {
  buildChatSearchSnippet,
  CHAT_SEARCH_MAX_HITS_PER_SESSION,
  parseChatSearchTerms,
  searchChatTranscripts,
  type ChatSearchDeps,
} from "./chat-search.js";

type FakeMessage = { role: string; content: unknown; timestamp?: number };

function entry(sessionId: string, updatedAt: number, extra: Partial<SessionEntry> = {}) {
  return { sessionId, updatedAt, ...extra } as SessionEntry;
}

function fakeDeps(params: {
  sessions: Array<{ sessionKey: string; entry: SessionEntry; messages: FakeMessage[] }>;
  now?: () => number;
  agents?: string[];
}): Partial<ChatSearchDeps> {
  const transcripts = new Map(
    params.sessions.map((session) => [
      session.entry.sessionId,
      session.messages.map((message, index) => ({
        id: `${session.entry.sessionId}-m${index}`,
        record: { message } as Record<string, unknown>,
      })),
    ]),
  );
  return {
    listAgentIds: () => params.agents ?? ["main"],
    resolveStorePath: (_cfg, agentId) => `/store/${agentId}/sessions.json`,
    listSessions: (agentId) =>
      agentId === "main"
        ? params.sessions.map(({ sessionKey, entry: sessionEntry }) => ({
            sessionKey,
            entry: sessionEntry,
          }))
        : [],
    resolveTranscriptPath: (session) => session.entry.sessionId,
    readTranscript: async (filePath) => {
      const entries = transcripts.get(filePath);
      return entries ? { entries } : null;
    },
    now: params.now ?? (() => 0),
  };
}

const cfg = {} as DaisyClawConfig;

describe("chat search terms", () => {
  it("splits words and keeps quoted phrases together", () => {
    expect(parseChatSearchTerms('Passport "renewal form"  PASSPORT')).toEqual([
      "passport",
      "renewal form",
    ]);
  });

  it("folds accents so café matches cafe", () => {
    expect(parseChatSearchTerms("Café")).toEqual(["cafe"]);
  });
});

describe("chat search snippets", () => {
  it("returns a short text whole", () => {
    expect(buildChatSearchSnippet("Renew my passport today", ["passport"])).toBe(
      "Renew my passport today",
    );
  });

  it("cuts a long text around the match at word boundaries", () => {
    const text = `${"word ".repeat(40)}passport ${"tail ".repeat(40)}`.trim();
    const snippet = buildChatSearchSnippet(text, ["passport"]);
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
    expect(snippet).toContain("passport");
    expect(snippet).not.toMatch(/^…\S*wor[^d]/);
    expect(snippet.length).toBeLessThan(text.length);
  });
});

describe("searchChatTranscripts", () => {
  it("finds a word in user and assistant messages, newest chat first", async () => {
    const result = await searchChatTranscripts({
      cfg,
      query: "passport",
      deps: fakeDeps({
        sessions: [
          {
            sessionKey: "agent:main:dashboard:old",
            entry: entry("old", 100, { label: "Old trip" }),
            messages: [{ role: "user", content: "Where is my passport?" }],
          },
          {
            sessionKey: "agent:main:dashboard:new",
            entry: entry("new", 200, { label: "Visa" }),
            messages: [
              { role: "user", content: [{ type: "text", text: "Help with the visa" }] },
              {
                role: "assistant",
                content: [{ type: "text", text: "Bring your passport and two photos." }],
              },
            ],
          },
        ],
      }),
    });
    expect(result.results.map((hit) => [hit.sessionKey, hit.role])).toEqual([
      ["agent:main:dashboard:new", "assistant"],
      ["agent:main:dashboard:old", "user"],
    ]);
    expect(result.results[0]).toMatchObject({
      sessionLabel: "Visa",
      messageId: "new-m1",
      snippet: "Bring your passport and two photos.",
    });
    expect(result.truncated).toBe(false);
    expect(result.scannedSessions).toBe(2);
  });

  it("requires every word, in any order", async () => {
    const deps = fakeDeps({
      sessions: [
        {
          sessionKey: "agent:main:dashboard:a",
          entry: entry("a", 1),
          messages: [
            { role: "user", content: "renewal of the passport" },
            { role: "user", content: "passport only" },
          ],
        },
      ],
    });
    const result = await searchChatTranscripts({ cfg, query: "passport renewal", deps });
    expect(result.results.map((hit) => hit.snippet)).toEqual(["renewal of the passport"]);
  });

  it("does not search tool output, scheduled jobs or sub-agents", async () => {
    const result = await searchChatTranscripts({
      cfg,
      query: "invoice",
      deps: fakeDeps({
        sessions: [
          {
            sessionKey: "agent:main:dashboard:chat",
            entry: entry("chat", 3),
            messages: [{ role: "toolResult", content: "invoice.pdf saved" }],
          },
          {
            sessionKey: "agent:main:cron:daily",
            entry: entry("cron", 2),
            messages: [{ role: "user", content: "send the invoice" }],
          },
          {
            sessionKey: "agent:main:subagent:x",
            entry: entry("sub", 1),
            messages: [{ role: "assistant", content: "invoice done" }],
          },
          {
            sessionKey: "agent:main:dashboard:spawned",
            entry: entry("spawned", 1, { spawnedBy: "agent:main:main" }),
            messages: [{ role: "assistant", content: "invoice done" }],
          },
        ],
      }),
    });
    expect(result.results).toEqual([]);
  });

  it("lets one chat contribute only a few results", async () => {
    const messages = Array.from({ length: 10 }, (_, index) => ({
      role: "user",
      content: `note ${index} about taxes`,
    }));
    const result = await searchChatTranscripts({
      cfg,
      query: "taxes",
      deps: fakeDeps({
        sessions: [{ sessionKey: "agent:main:dashboard:t", entry: entry("t", 1), messages }],
      }),
    });
    expect(result.results).toHaveLength(CHAT_SEARCH_MAX_HITS_PER_SESSION);
    // Newest message first.
    expect(result.results[0].snippet).toBe("note 9 about taxes");
  });

  it("stops at the limit and says the search was cut short", async () => {
    const sessions = Array.from({ length: 5 }, (_, index) => ({
      sessionKey: `agent:main:dashboard:s${index}`,
      entry: entry(`s${index}`, 100 - index),
      messages: [{ role: "user", content: "flight to Delhi" }],
    }));
    const result = await searchChatTranscripts({
      cfg,
      query: "delhi",
      limit: 2,
      deps: fakeDeps({ sessions }),
    });
    expect(result.results).toHaveLength(2);
    expect(result.truncated).toBe(true);
  });

  it("stops when the time budget runs out", async () => {
    let clock = 0;
    const sessions = Array.from({ length: 4 }, (_, index) => ({
      sessionKey: `agent:main:dashboard:s${index}`,
      entry: entry(`s${index}`, 100 - index),
      messages: [{ role: "user", content: "nothing relevant" }],
    }));
    const deps = fakeDeps({ sessions, now: () => clock });
    const readTranscript = deps.readTranscript!;
    deps.readTranscript = async (filePath) => {
      clock += 2_000;
      return readTranscript(filePath);
    };
    const result = await searchChatTranscripts({ cfg, query: "relevant", deps });
    expect(result.truncated).toBe(true);
    expect(result.scannedSessions).toBeLessThan(4);
  });

  it("ignores a query shorter than two characters", async () => {
    const result = await searchChatTranscripts({
      cfg,
      query: " a ",
      deps: fakeDeps({
        sessions: [
          {
            sessionKey: "agent:main:dashboard:a",
            entry: entry("a", 1),
            messages: [{ role: "user", content: "a" }],
          },
        ],
      }),
    });
    expect(result).toEqual({ query: "a", results: [], scannedSessions: 0, truncated: false });
  });

  it("keeps searching when one transcript cannot be read", async () => {
    const deps = fakeDeps({
      sessions: [
        {
          sessionKey: "agent:main:dashboard:broken",
          entry: entry("broken", 2),
          messages: [],
        },
        {
          sessionKey: "agent:main:dashboard:ok",
          entry: entry("ok", 1),
          messages: [{ role: "user", content: "the lease agreement" }],
        },
      ],
    });
    const readTranscript = deps.readTranscript!;
    deps.readTranscript = async (filePath) => {
      if (filePath === "broken") {
        throw new Error("EACCES");
      }
      return readTranscript(filePath);
    };
    const result = await searchChatTranscripts({ cfg, query: "lease", deps });
    expect(result.results.map((hit) => hit.sessionKey)).toEqual(["agent:main:dashboard:ok"]);
  });
});
