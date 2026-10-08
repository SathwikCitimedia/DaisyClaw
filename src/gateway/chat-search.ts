// Searches the words people actually exchanged across their recent chats.
//
// Session search in sessions.list only matches names and metadata; this reads
// the transcripts themselves. It walks the most recently used chats newest
// first, reads each active branch (so a reply that was edited or regenerated
// away is not found again), and stops early at a result cap or a time budget so
// one keystroke in the search box can never hold the gateway for long.
import path from "node:path";
import { listAgentIds } from "../agents/agent-scope.js";
import {
  listSessionEntries,
  resolveSessionFilePath,
  resolveStorePath,
} from "../config/sessions.js";
import type { SessionEntry } from "../config/sessions/types.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { isCronSessionKey, isSubagentSessionKey } from "../sessions/session-key-utils.js";
import { extractTextFromChatContent } from "../shared/chat-content.js";
import { extractAssistantVisibleText } from "../shared/chat-message-content.js";
import { readSessionTranscriptIndex } from "./session-transcript-index.fs.js";

export const CHAT_SEARCH_QUERY_MIN_LENGTH = 2;
export const CHAT_SEARCH_QUERY_MAX_LENGTH = 200;
export const CHAT_SEARCH_DEFAULT_LIMIT = 30;
export const CHAT_SEARCH_MAX_LIMIT = 50;
/** How many of the most recently used chats are read. */
export const CHAT_SEARCH_MAX_SESSIONS = 200;
/** A single chat contributes at most this many results, so one long chat cannot crowd out the rest. */
export const CHAT_SEARCH_MAX_HITS_PER_SESSION = 3;
export const CHAT_SEARCH_TIME_BUDGET_MS = 2_500;
/** Oversized records (pasted files, tool dumps) are skipped rather than parsed for a snippet. */
const MAX_SEARCHABLE_MESSAGE_CHARS = 200_000;
const SNIPPET_CONTEXT_CHARS = 60;

export type ChatSearchHit = {
  sessionKey: string;
  agentId: string;
  sessionLabel?: string;
  updatedAt?: number;
  messageId?: string;
  role: "user" | "assistant";
  snippet: string;
  timestamp?: number;
};

export type ChatSearchResult = {
  query: string;
  results: ChatSearchHit[];
  scannedSessions: number;
  /** True when the cap or the time budget stopped the search before every chat was read. */
  truncated: boolean;
};

type SearchableSession = {
  sessionKey: string;
  agentId: string;
  storePath: string;
  entry: SessionEntry;
};

export type ChatSearchDeps = {
  listAgentIds: (cfg: DaisyClawConfig) => string[];
  listSessions: (
    agentId: string,
    storePath: string,
  ) => Array<{ sessionKey: string; entry: SessionEntry }>;
  resolveStorePath: (cfg: DaisyClawConfig, agentId: string) => string;
  resolveTranscriptPath: (session: SearchableSession) => string;
  readTranscript: (
    filePath: string,
  ) => Promise<{ entries: ReadonlyArray<{ id?: string; record: Record<string, unknown> }> } | null>;
  now: () => number;
};

const defaultDeps: ChatSearchDeps = {
  listAgentIds,
  listSessions: (agentId, storePath) => listSessionEntries({ agentId, storePath }),
  resolveStorePath: (cfg, agentId) => resolveStorePath(cfg.session?.store, { agentId }),
  resolveTranscriptPath: ({ entry, storePath, agentId }) =>
    resolveSessionFilePath(
      entry.sessionId,
      entry.sessionFile ? { sessionFile: entry.sessionFile } : undefined,
      {
        sessionsDir: path.dirname(storePath),
        agentId,
      },
    ),
  // Skip the shared index cache: a search reads many chats once and should not
  // evict the ones the user has open.
  readTranscript: (filePath) => readSessionTranscriptIndex(filePath, { cache: "skip" }),
  now: () => Date.now(),
};

/** Lowercase, accent-folded, whitespace-collapsed text for matching. */
export function foldChatSearchText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Every word of the query must appear; a quoted phrase is kept together. */
export function parseChatSearchTerms(query: string): string[] {
  const terms: string[] = [];
  const pattern = /"([^"]+)"|(\S+)/g;
  for (const match of query.matchAll(pattern)) {
    const term = foldChatSearchText(match[1] ?? match[2] ?? "");
    if (term && !terms.includes(term)) {
      terms.push(term);
    }
  }
  return terms;
}

function isSearchableChat(sessionKey: string, entry: SessionEntry): boolean {
  if (!entry.sessionId?.trim()) {
    return false;
  }
  // Background runs are not conversations the user had.
  if (isCronSessionKey(sessionKey) || isSubagentSessionKey(sessionKey) || entry.spawnedBy) {
    return false;
  }
  return true;
}

function readMessageText(message: Record<string, unknown>): string | null {
  if (message.role === "user") {
    return extractTextFromChatContent(message.content);
  }
  if (message.role === "assistant") {
    return extractAssistantVisibleText(message) ?? null;
  }
  return null;
}

/**
 * A short excerpt around the first match, cut at word boundaries, with "…"
 * where text was left out. Offsets are found on the folded text, which keeps
 * the original's length for the scripts people type (accents fold away).
 */
export function buildChatSearchSnippet(text: string, terms: readonly string[]): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const folded = flat
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
  const sameLength = folded.length === flat.length;
  let at = -1;
  let length = 0;
  for (const term of terms) {
    const index = folded.indexOf(term);
    if (index >= 0 && (at < 0 || index < at)) {
      at = index;
      length = term.length;
    }
  }
  if (at < 0 || !sameLength) {
    return flat.length > SNIPPET_CONTEXT_CHARS * 2
      ? `${flat.slice(0, SNIPPET_CONTEXT_CHARS * 2).trimEnd()}…`
      : flat;
  }
  let start = Math.max(0, at - SNIPPET_CONTEXT_CHARS);
  let end = Math.min(flat.length, at + length + SNIPPET_CONTEXT_CHARS);
  if (start > 0) {
    const space = flat.indexOf(" ", start);
    start = space >= 0 && space < at ? space + 1 : start;
  }
  if (end < flat.length) {
    const space = flat.lastIndexOf(" ", end);
    end = space > at + length ? space : end;
  }
  return `${start > 0 ? "…" : ""}${flat.slice(start, end)}${end < flat.length ? "…" : ""}`;
}

function readTimestamp(record: Record<string, unknown>, message: Record<string, unknown>) {
  for (const value of [message.timestamp, record.timestamp]) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

export async function searchChatTranscripts(params: {
  cfg: DaisyClawConfig;
  query: string;
  agentId?: string;
  limit?: number;
  deps?: Partial<ChatSearchDeps>;
}): Promise<ChatSearchResult> {
  const deps: ChatSearchDeps = { ...defaultDeps, ...params.deps };
  const query = params.query.trim().slice(0, CHAT_SEARCH_QUERY_MAX_LENGTH);
  const limit = Math.min(
    Math.max(1, Math.floor(params.limit ?? CHAT_SEARCH_DEFAULT_LIMIT)),
    CHAT_SEARCH_MAX_LIMIT,
  );
  const terms = parseChatSearchTerms(query);
  const empty: ChatSearchResult = { query, results: [], scannedSessions: 0, truncated: false };
  if (foldChatSearchText(query).length < CHAT_SEARCH_QUERY_MIN_LENGTH || terms.length === 0) {
    return empty;
  }

  const wantedAgentId = params.agentId ? normalizeAgentId(params.agentId) : undefined;
  const sessions: SearchableSession[] = [];
  for (const agentId of deps.listAgentIds(params.cfg)) {
    if (wantedAgentId && normalizeAgentId(agentId) !== wantedAgentId) {
      continue;
    }
    const storePath = deps.resolveStorePath(params.cfg, agentId);
    let entries: Array<{ sessionKey: string; entry: SessionEntry }>;
    try {
      entries = deps.listSessions(agentId, storePath);
    } catch {
      continue;
    }
    for (const { sessionKey, entry } of entries) {
      if (isSearchableChat(sessionKey, entry)) {
        sessions.push({ sessionKey, agentId, storePath, entry });
      }
    }
  }
  sessions.sort((a, b) => (b.entry.updatedAt ?? 0) - (a.entry.updatedAt ?? 0));
  const candidates = sessions.slice(0, CHAT_SEARCH_MAX_SESSIONS);

  const deadline = deps.now() + CHAT_SEARCH_TIME_BUDGET_MS;
  const results: ChatSearchHit[] = [];
  let scannedSessions = 0;
  let truncated = sessions.length > candidates.length;
  for (const session of candidates) {
    if (results.length >= limit || deps.now() > deadline) {
      truncated = true;
      break;
    }
    let index: Awaited<ReturnType<ChatSearchDeps["readTranscript"]>>;
    try {
      index = await deps.readTranscript(deps.resolveTranscriptPath(session));
    } catch {
      index = null;
    }
    scannedSessions += 1;
    if (!index) {
      continue;
    }
    const label = session.entry.label?.trim() || session.entry.displayName?.trim() || undefined;
    let sessionHits = 0;
    // Newest messages first: the latest mention is usually the one people want.
    for (
      let i = index.entries.length - 1;
      i >= 0 && sessionHits < CHAT_SEARCH_MAX_HITS_PER_SESSION;
      i--
    ) {
      const { id, record } = index.entries[i];
      const message = record.message;
      if (!message || typeof message !== "object") {
        continue;
      }
      const m = message as Record<string, unknown>;
      const text = readMessageText(m);
      if (!text || text.length > MAX_SEARCHABLE_MESSAGE_CHARS) {
        continue;
      }
      const folded = foldChatSearchText(text);
      if (!terms.every((term) => folded.includes(term))) {
        continue;
      }
      sessionHits += 1;
      results.push({
        sessionKey: session.sessionKey,
        agentId: session.agentId,
        ...(label ? { sessionLabel: label } : {}),
        ...(typeof session.entry.updatedAt === "number"
          ? { updatedAt: session.entry.updatedAt }
          : {}),
        ...(id ? { messageId: id } : {}),
        role: m.role === "user" ? "user" : "assistant",
        snippet: buildChatSearchSnippet(text, terms),
        ...(readTimestamp(record, m) !== undefined ? { timestamp: readTimestamp(record, m) } : {}),
      });
      if (results.length >= limit) {
        break;
      }
    }
  }
  return { query, results: results.slice(0, limit), scannedSessions, truncated };
}
