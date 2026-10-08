import { describe, expect, it } from "vitest";
import {
  buildSidebarChatSections,
  resolveSidebarChatBucket,
  togglePinnedSession,
} from "./sidebar-chat-groups.ts";
import type { GatewaySessionRow } from "./types.ts";

// Wednesday 10 June 2026, 15:00 local time.
const now = new Date(2026, 5, 10, 15, 0, 0);
const at = (days: number, hour = 12) => new Date(2026, 5, 10 - days, hour, 0, 0).getTime();

function row(key: string, updatedAt: number | null, label?: string): GatewaySessionRow {
  return { key, updatedAt, ...(label ? { label } : {}) } as GatewaySessionRow;
}

const labelFor = (key: string, value?: GatewaySessionRow) => value?.label ?? `name:${key}`;

describe("resolveSidebarChatBucket", () => {
  it("groups by calendar day", () => {
    expect(resolveSidebarChatBucket(at(0, 0), now)).toBe("today");
    expect(resolveSidebarChatBucket(at(1, 23), now)).toBe("yesterday");
    expect(resolveSidebarChatBucket(at(1, 0), now)).toBe("yesterday");
    expect(resolveSidebarChatBucket(at(2), now)).toBe("previous7Days");
    expect(resolveSidebarChatBucket(at(7), now)).toBe("previous7Days");
    expect(resolveSidebarChatBucket(at(8), now)).toBe("older");
    expect(resolveSidebarChatBucket(null, now)).toBe("older");
  });
});

describe("buildSidebarChatSections", () => {
  it("puts pinned chats first, in pin order, and does not repeat them", () => {
    const rows = [
      row("a", at(0), "Groceries"),
      row("b", at(1), "Taxes"),
      row("c", at(3), "Trip"),
      row("d", at(30), "Recipes"),
    ];
    const { sections, hasMore } = buildSidebarChatSections({
      rows,
      pinned: [
        { key: "d", label: "Recipes" },
        { key: "b", label: "Taxes" },
      ],
      now,
      labelFor,
    });
    expect(sections.map((section) => [section.bucket, section.entries.map((e) => e.key)])).toEqual([
      ["pinned", ["d", "b"]],
      ["today", ["a"]],
      ["previous7Days", ["c"]],
    ]);
    expect(sections[0].entries.every((entry) => entry.pinned)).toBe(true);
    expect(hasMore).toBe(false);
  });

  it("keeps a pinned chat older than the loaded list under its saved name", () => {
    const { sections } = buildSidebarChatSections({
      rows: [row("a", at(0), "Today chat")],
      pinned: [{ key: "old", label: "Passport renewal" }],
      now,
      labelFor,
    });
    expect(sections[0].entries[0]).toEqual({
      key: "old",
      row: undefined,
      label: "Passport renewal",
      pinned: true,
    });
  });

  it("shows up to the limit and says when more exist", () => {
    const rows = Array.from({ length: 5 }, (_, index) => row(`k${index}`, at(0)));
    const result = buildSidebarChatSections({ rows, pinned: [], now, limit: 3, labelFor });
    expect(result.sections[0].entries).toHaveLength(3);
    expect(result.hasMore).toBe(true);
  });
});

describe("togglePinnedSession", () => {
  it("adds to the end and removes by key", () => {
    const pinned = togglePinnedSession([{ key: "a", label: "A" }], "b", "B");
    expect(pinned).toEqual([
      { key: "a", label: "A" },
      { key: "b", label: "B" },
    ]);
    expect(togglePinnedSession(pinned, "a", "A")).toEqual([{ key: "b", label: "B" }]);
  });
});
