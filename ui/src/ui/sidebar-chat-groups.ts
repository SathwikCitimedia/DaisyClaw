// Control UI module groups the sidebar's chats: pinned first, then by how recently they were used.
import type { PinnedSessionRef } from "./storage.ts";
import type { GatewaySessionRow } from "./types.ts";

export type SidebarChatBucket = "pinned" | "today" | "yesterday" | "previous7Days" | "older";

export type SidebarChatEntry = {
  key: string;
  /** Absent for a pinned chat older than the loaded chat list. */
  row?: GatewaySessionRow;
  label: string;
  pinned: boolean;
};

export type SidebarChatSection = {
  bucket: SidebarChatBucket;
  entries: SidebarChatEntry[];
};

export type SidebarChatSections = {
  sections: SidebarChatSection[];
  /** More chats exist than the sidebar shows; offer "See all chats". */
  hasMore: boolean;
};

export const SIDEBAR_RECENT_CHAT_LIMIT = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function resolveSidebarChatBucket(
  updatedAt: number | null | undefined,
  now: Date,
): Exclude<SidebarChatBucket, "pinned"> {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || updatedAt <= 0) {
    return "older";
  }
  const today = startOfLocalDay(now);
  if (updatedAt >= today) {
    return "today";
  }
  // Calendar days, not 24-hour windows, so "Yesterday" matches the wall clock
  // (and a daylight-saving change cannot move a chat across the line).
  const yesterday = startOfLocalDay(new Date(today - DAY_MS / 2));
  if (updatedAt >= yesterday) {
    return "yesterday";
  }
  const weekStart = startOfLocalDay(new Date(today - 7 * DAY_MS + DAY_MS / 2));
  if (updatedAt >= weekStart) {
    return "previous7Days";
  }
  return "older";
}

const BUCKET_ORDER: ReadonlyArray<Exclude<SidebarChatBucket, "pinned">> = [
  "today",
  "yesterday",
  "previous7Days",
  "older",
];

/**
 * `rows` are the chats the sidebar may show, newest first. Pinned chats lead in
 * the order they were pinned and are not repeated below.
 */
export function buildSidebarChatSections(params: {
  rows: readonly GatewaySessionRow[];
  pinned: readonly PinnedSessionRef[];
  now: Date;
  limit?: number;
  labelFor: (key: string, row?: GatewaySessionRow) => string;
}): SidebarChatSections {
  const limit = params.limit ?? SIDEBAR_RECENT_CHAT_LIMIT;
  const rowsByKey = new Map(params.rows.map((row) => [row.key, row]));
  const pinnedKeys = new Set(params.pinned.map((pin) => pin.key));

  const pinnedEntries: SidebarChatEntry[] = params.pinned.map((pin) => {
    const row = rowsByKey.get(pin.key);
    return {
      key: pin.key,
      row,
      label: row ? params.labelFor(pin.key, row) : pin.label.trim() || params.labelFor(pin.key),
      pinned: true,
    };
  });

  const unpinned = params.rows.filter((row) => !pinnedKeys.has(row.key));
  const shown = unpinned.slice(0, limit);
  const byBucket = new Map<Exclude<SidebarChatBucket, "pinned">, SidebarChatEntry[]>();
  for (const row of shown) {
    const bucket = resolveSidebarChatBucket(row.updatedAt, params.now);
    const entries = byBucket.get(bucket) ?? [];
    entries.push({ key: row.key, row, label: params.labelFor(row.key, row), pinned: false });
    byBucket.set(bucket, entries);
  }

  const sections: SidebarChatSection[] = [];
  if (pinnedEntries.length > 0) {
    sections.push({ bucket: "pinned", entries: pinnedEntries });
  }
  for (const bucket of BUCKET_ORDER) {
    const entries = byBucket.get(bucket);
    if (entries && entries.length > 0) {
      sections.push({ bucket, entries });
    }
  }
  return { sections, hasMore: unpinned.length > shown.length };
}

/** Pin order is kept; pinning an already pinned chat only refreshes its name. */
export function togglePinnedSession(
  pinned: readonly PinnedSessionRef[],
  key: string,
  label: string,
): PinnedSessionRef[] {
  if (pinned.some((pin) => pin.key === key)) {
    return pinned.filter((pin) => pin.key !== key);
  }
  return [...pinned, { key, label }];
}
