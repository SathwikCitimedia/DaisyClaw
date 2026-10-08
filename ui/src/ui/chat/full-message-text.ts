// Control UI chat module fetches the full text of a message that arrived cut
// short, so a long reply reads to its end in the conversation itself.
//
// Chat history caps very long messages to keep loading quick and marks the cut
// with "...(truncated)...". The whole message is still saved; this asks the
// gateway for it once per message and remembers the answer.

export const TRUNCATION_MARKER = "\n...(truncated)...";

/** Matches the side panel's limit for the same request. */
const FULL_MESSAGE_MAX_CHARS = 500_000;

type FullMessageClient = {
  request: <T = unknown>(method: string, params?: unknown) => Promise<T>;
};

let activeClient: FullMessageClient | null = null;
/** Full text by message, or null once the gateway said it cannot be had. */
const fetched = new Map<string, string | null>();
const inFlight = new Set<string>();

/** The connection to ask; set whenever the app (re)connects. */
export function setFullMessageClient(client: FullMessageClient | null): void {
  if (client !== activeClient) {
    activeClient = client;
    inFlight.clear();
  }
}

/** Test seam: forget fetched messages. */
export function resetFullMessageTextForTest(): void {
  activeClient = null;
  fetched.clear();
  inFlight.clear();
}

function cacheKey(sessionKey: string, messageId: string): string {
  return `${sessionKey}\u0000${messageId}`;
}

function extractText(message: unknown): string | null {
  if (!message || typeof message !== "object") {
    return null;
  }
  const record = message as { text?: unknown; content?: unknown };
  if (typeof record.text === "string") {
    return record.text;
  }
  if (typeof record.content === "string") {
    return record.content;
  }
  if (Array.isArray(record.content)) {
    const parts = record.content
      .map((block) =>
        block && typeof block === "object" && (block as { type?: unknown }).type === "text"
          ? (block as { text?: unknown }).text
          : null,
      )
      .filter((text): text is string => typeof text === "string");
    return parts.length > 0 ? parts.join("\n") : null;
  }
  return null;
}

/**
 * The message's full text when it has been fetched. Otherwise starts fetching
 * it and returns undefined; `onReady` runs once the text is in.
 */
export function resolveFullMessageText(params: {
  sessionKey: string;
  agentId?: string;
  messageId: string;
  onReady?: () => void;
}): string | undefined {
  const key = cacheKey(params.sessionKey, params.messageId);
  if (fetched.has(key)) {
    return fetched.get(key) ?? undefined;
  }
  const client = activeClient;
  if (!client || inFlight.has(key)) {
    return undefined;
  }
  inFlight.add(key);
  void client
    .request<{ ok?: boolean; message?: unknown }>("chat.message.get", {
      sessionKey: params.sessionKey,
      ...(params.agentId ? { agentId: params.agentId } : {}),
      messageId: params.messageId,
      maxChars: FULL_MESSAGE_MAX_CHARS,
    })
    .then((result) => {
      const text = result?.ok ? extractText(result.message) : null;
      fetched.set(key, text && !text.includes(TRUNCATION_MARKER) ? text : null);
    })
    .catch(() => {
      // Left uncached: a dropped connection should not hide the rest for good.
    })
    .finally(() => {
      inFlight.delete(key);
      if (fetched.has(key)) {
        params.onReady?.();
      }
    });
  return undefined;
}
