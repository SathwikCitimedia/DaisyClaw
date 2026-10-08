// Control UI chat module runs the "In your chats" search behind the Ctrl+K box.
//
// Each keystroke waits a moment before asking the gateway, so typing a word is
// one search rather than one per letter, and an answer that arrives after the
// user has typed something else is dropped instead of flashing stale results.

export type ChatSearchHitView = {
  sessionKey: string;
  agentId?: string;
  sessionLabel?: string;
  messageId?: string;
  role: "user" | "assistant";
  snippet: string;
  timestamp?: number;
};

export type PaletteChatSearchStatus = "idle" | "loading" | "done" | "error" | "unsupported";

export type PaletteChatSearchState = {
  query: string;
  status: PaletteChatSearchStatus;
  results: ChatSearchHitView[];
  truncated: boolean;
};

export const IDLE_PALETTE_CHAT_SEARCH: PaletteChatSearchState = {
  query: "",
  status: "idle",
  results: [],
  truncated: false,
};

export const PALETTE_CHAT_SEARCH_MIN_CHARS = 2;
const PALETTE_CHAT_SEARCH_DEBOUNCE_MS = 250;
const PALETTE_CHAT_SEARCH_LIMIT = 20;
const UNKNOWN_METHOD_PATTERN = /unknown method|method not found|unsupported method|-32601/i;

type SearchClient = {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
};

export type PaletteChatSearchHost = {
  client: SearchClient | null;
  connected: boolean;
  paletteChatSearch: PaletteChatSearchState;
  hello?: { features?: { methods?: unknown } } | null;
  requestUpdate?: () => void;
};

type PendingSearch = {
  timer: ReturnType<typeof setTimeout> | null;
  seq: number;
};

const pendingByHost = new WeakMap<object, PendingSearch>();

function pendingFor(host: object): PendingSearch {
  let pending = pendingByHost.get(host);
  if (!pending) {
    pending = { timer: null, seq: 0 };
    pendingByHost.set(host, pending);
  }
  return pending;
}

/** False when the connected gateway says it has no chat.search (an older engine). */
function gatewayOffersChatSearch(host: PaletteChatSearchHost): boolean {
  const methods = host.hello?.features?.methods;
  return !Array.isArray(methods) || methods.includes("chat.search");
}

function normalizeHits(value: unknown): ChatSearchHitView[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== "object") {
      return [];
    }
    const hit = raw as Record<string, unknown>;
    if (typeof hit.sessionKey !== "string" || typeof hit.snippet !== "string") {
      return [];
    }
    return [
      {
        sessionKey: hit.sessionKey,
        ...(typeof hit.agentId === "string" ? { agentId: hit.agentId } : {}),
        ...(typeof hit.sessionLabel === "string" ? { sessionLabel: hit.sessionLabel } : {}),
        ...(typeof hit.messageId === "string" ? { messageId: hit.messageId } : {}),
        role: hit.role === "user" ? "user" : "assistant",
        snippet: hit.snippet,
        ...(typeof hit.timestamp === "number" ? { timestamp: hit.timestamp } : {}),
      } satisfies ChatSearchHitView,
    ];
  });
}

export function cancelPaletteChatSearch(host: PaletteChatSearchHost) {
  const pending = pendingFor(host);
  if (pending.timer) {
    clearTimeout(pending.timer);
    pending.timer = null;
  }
  pending.seq += 1;
  host.paletteChatSearch = IDLE_PALETTE_CHAT_SEARCH;
}

export function schedulePaletteChatSearch(
  host: PaletteChatSearchHost,
  rawQuery: string,
  opts: { debounceMs?: number } = {},
) {
  const query = rawQuery.trim();
  const pending = pendingFor(host);
  if (pending.timer) {
    clearTimeout(pending.timer);
    pending.timer = null;
  }
  pending.seq += 1;
  if (!gatewayOffersChatSearch(host)) {
    host.paletteChatSearch = { ...IDLE_PALETTE_CHAT_SEARCH, status: "unsupported" };
    return;
  }
  if (query.length < PALETTE_CHAT_SEARCH_MIN_CHARS || !host.client || !host.connected) {
    host.paletteChatSearch = IDLE_PALETTE_CHAT_SEARCH;
    return;
  }
  // Keep the previous results on screen while the next search runs, so the
  // list does not blink empty on every keystroke.
  host.paletteChatSearch = {
    query,
    status: "loading",
    results: host.paletteChatSearch?.results ?? [],
    truncated: false,
  };
  const seq = pending.seq;
  pending.timer = setTimeout(() => {
    pending.timer = null;
    const client = host.client;
    if (!client || !host.connected) {
      // Never leave "Searching…" on screen for a search that will not run.
      host.paletteChatSearch = IDLE_PALETTE_CHAT_SEARCH;
      host.requestUpdate?.();
      return;
    }
    void client
      .request<{ results?: unknown; truncated?: unknown }>("chat.search", {
        query,
        limit: PALETTE_CHAT_SEARCH_LIMIT,
      })
      .then(
        (res) => {
          if (seq !== pending.seq) {
            return;
          }
          host.paletteChatSearch = {
            query,
            status: "done",
            results: normalizeHits(res?.results),
            truncated: res?.truncated === true,
          };
        },
        (err: unknown) => {
          if (seq !== pending.seq) {
            return;
          }
          const message = err instanceof Error ? err.message : String(err ?? "");
          host.paletteChatSearch = {
            query,
            status: UNKNOWN_METHOD_PATTERN.test(message) ? "unsupported" : "error",
            results: [],
            truncated: false,
          };
        },
      )
      .finally(() => {
        if (seq === pending.seq) {
          host.requestUpdate?.();
        }
      });
  }, opts.debounceMs ?? PALETTE_CHAT_SEARCH_DEBOUNCE_MS);
}
