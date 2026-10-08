// Control UI chat module implements pinned messages behavior.
//
// A pin names a message by its identity, never by its position: positions
// shift whenever older history loads or an edit hides a turn, and a pin that
// silently moves to a different message is worse than no pin at all. Each pin
// also keeps a short copy of the text, so the pinned bar can list a message
// that is further up than the part of the chat currently loaded.
import { getSafeLocalStorage } from "../../local-storage.ts";
import { getOrCreateSessionCacheValue } from "./session-cache.ts";

// A new prefix: the old index-based store (daisyclaw:pinned:) had no way to
// create a pin, so there is nothing in it worth carrying over.
const PREFIX = "daisyclaw:pinned-messages:";
const MAX_PINS = 50;
const MAX_SUMMARY_CHARS = 500;

export type PinnedMessageRole = "user" | "assistant";

export type PinnedMessageEntry = {
  id: string;
  role: PinnedMessageRole;
  text: string;
  timestamp?: number;
  pinnedAt: number;
};

/**
 * Every identity a message is known by, strongest first: the gateway
 * transcript id, then the message's own id, then its role and time. A reply
 * that has just streamed in is known only by role and time until the chat
 * reloads and it gains its transcript id, so a pin made in that moment must
 * still find it afterwards; matching on any of these keeps it found.
 */
export function resolvePinnableMessageIds(message: unknown): string[] {
  if (!message || typeof message !== "object") {
    return [];
  }
  const m = message as Record<string, unknown>;
  const ids: string[] = [];
  const marker = m["__daisyclaw"];
  if (marker && typeof marker === "object" && !Array.isArray(marker)) {
    const id = (marker as Record<string, unknown>).id;
    if (typeof id === "string" && id) {
      ids.push(`t:${id}`);
    }
  }
  for (const field of ["id", "messageId"] as const) {
    const value = m[field];
    if (typeof value === "string" && value && !ids.includes(`m:${value}`)) {
      ids.push(`m:${value}`);
    }
  }
  const role = typeof m.role === "string" ? m.role : "";
  if (role && typeof m.timestamp === "number" && Number.isFinite(m.timestamp)) {
    ids.push(`ts:${role}:${m.timestamp}`);
  }
  return ids;
}

/** The identity a new pin holds on to; null when the message has none yet (a reply still streaming). */
export function resolvePinnableMessageId(message: unknown): string | null {
  return resolvePinnableMessageIds(message)[0] ?? null;
}

function isPinnedEntry(value: unknown): value is PinnedMessageEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    (entry.role === "user" || entry.role === "assistant") &&
    typeof entry.text === "string" &&
    typeof entry.pinnedAt === "number"
  );
}

type PinStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export class PinnedMessages {
  private key: string;
  private items = new Map<string, PinnedMessageEntry>();
  private storage: PinStorage | null;

  constructor(sessionKey: string, storage: PinStorage | null = getSafeLocalStorage()) {
    this.key = PREFIX + sessionKey;
    this.storage = storage;
    this.load();
  }

  /** Pins in conversation order (oldest message first). */
  get entries(): PinnedMessageEntry[] {
    return [...this.items.values()].toSorted(
      (a, b) => (a.timestamp ?? a.pinnedAt) - (b.timestamp ?? b.pinnedAt),
    );
  }

  get size(): number {
    return this.items.size;
  }

  has(id: string): boolean {
    return this.items.has(id);
  }

  /** The pin, if any, held under one of a message's identities. */
  findPinned(ids: readonly string[]): string | null {
    return ids.find((id) => this.items.has(id)) ?? null;
  }

  pin(entry: Omit<PinnedMessageEntry, "pinnedAt">): void {
    const text = entry.text.trim().slice(0, MAX_SUMMARY_CHARS);
    this.items.set(entry.id, { ...entry, text, pinnedAt: Date.now() });
    while (this.items.size > MAX_PINS) {
      const oldest = this.items.keys().next().value;
      if (typeof oldest !== "string") {
        break;
      }
      this.items.delete(oldest);
    }
    this.save();
  }

  unpin(id: string): void {
    if (this.items.delete(id)) {
      this.save();
    }
  }

  toggle(entry: Omit<PinnedMessageEntry, "pinnedAt">): boolean {
    if (this.items.has(entry.id)) {
      this.unpin(entry.id);
      return false;
    }
    this.pin(entry);
    return true;
  }

  clear(): void {
    this.items.clear();
    try {
      this.storage?.removeItem(this.key);
    } catch {
      // ignore
    }
  }

  /** Changes whenever the set of pins changes; for render guards. */
  signature(): string {
    return [...this.items.keys()].join("\u0000");
  }

  private load(): void {
    try {
      const raw = this.storage?.getItem(this.key);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (isPinnedEntry(entry)) {
            this.items.set(entry.id, entry);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private save(): void {
    try {
      if (this.items.size === 0) {
        this.storage?.removeItem(this.key);
        return;
      }
      this.storage?.setItem(this.key, JSON.stringify([...this.items.values()]));
    } catch {
      // ignore
    }
  }
}

const pinnedMessagesBySession = new Map<string, PinnedMessages>();

export function getPinnedMessages(sessionKey: string): PinnedMessages {
  return getOrCreateSessionCacheValue(
    pinnedMessagesBySession,
    sessionKey,
    () => new PinnedMessages(sessionKey),
  );
}

/** A cleared or deleted chat takes its pins with it. */
export function forgetPinnedMessages(sessionKey: string): void {
  pinnedMessagesBySession.delete(sessionKey);
  new PinnedMessages(sessionKey).clear();
}
