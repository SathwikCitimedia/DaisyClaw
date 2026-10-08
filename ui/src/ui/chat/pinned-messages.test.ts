import { describe, expect, it } from "vitest";
import {
  PinnedMessages,
  resolvePinnableMessageId,
  resolvePinnableMessageIds,
} from "./pinned-messages.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

describe("resolvePinnableMessageId", () => {
  it("prefers the transcript id, then the message id, then role and time", () => {
    expect(resolvePinnableMessageId({ __daisyclaw: { id: "e1" }, id: "m1" })).toBe("t:e1");
    expect(resolvePinnableMessageId({ id: "m1", role: "user", timestamp: 5 })).toBe("m:m1");
    expect(resolvePinnableMessageId({ messageId: "m2" })).toBe("m:m2");
    expect(resolvePinnableMessageId({ role: "assistant", timestamp: 42 })).toBe("ts:assistant:42");
  });

  it("cannot pin a message with no identity yet", () => {
    expect(resolvePinnableMessageId({ role: "assistant" })).toBeNull();
    expect(resolvePinnableMessageId(null)).toBeNull();
  });
});

describe("pins made before a reply gains its transcript id", () => {
  it("still find the reply once the chat reloads with its id", () => {
    const pins = new PinnedMessages("s1", memoryStorage());
    // Just streamed in: known only by role and time.
    const live = { role: "assistant", content: "Paris", timestamp: 1700 };
    pins.pin({ id: resolvePinnableMessageId(live)!, role: "assistant", text: "Paris" });
    // After a reload the same reply carries its transcript id too.
    const reloaded = { ...live, __daisyclaw: { id: "e9" } };
    expect(resolvePinnableMessageIds(reloaded)).toEqual(["t:e9", "ts:assistant:1700"]);
    expect(pins.findPinned(resolvePinnableMessageIds(reloaded))).toBe("ts:assistant:1700");
  });
});

describe("PinnedMessages", () => {
  it("keeps pins by identity, in conversation order, across reloads", () => {
    const storage = memoryStorage();
    const pins = new PinnedMessages("s1", storage);
    pins.pin({ id: "t:b", role: "assistant", text: "second", timestamp: 20 });
    pins.pin({ id: "t:a", role: "user", text: "first", timestamp: 10 });
    expect(pins.entries.map((entry) => entry.id)).toEqual(["t:a", "t:b"]);

    const reloaded = new PinnedMessages("s1", storage);
    expect(reloaded.has("t:a")).toBe(true);
    expect(reloaded.entries.map((entry) => entry.text)).toEqual(["first", "second"]);
  });

  it("toggles, and forgets its storage once the last pin goes", () => {
    const storage = memoryStorage();
    const pins = new PinnedMessages("s1", storage);
    expect(pins.toggle({ id: "t:a", role: "user", text: "hi" })).toBe(true);
    expect(storage.data.size).toBe(1);
    expect(pins.toggle({ id: "t:a", role: "user", text: "hi" })).toBe(false);
    expect(pins.size).toBe(0);
    expect(storage.data.size).toBe(0);
  });

  it("changes its signature when pins change, for render guards", () => {
    const pins = new PinnedMessages("s1", memoryStorage());
    const before = pins.signature();
    pins.pin({ id: "t:a", role: "user", text: "hi" });
    expect(pins.signature()).not.toBe(before);
  });

  it("shortens very long text to a summary", () => {
    const pins = new PinnedMessages("s1", memoryStorage());
    pins.pin({ id: "t:a", role: "assistant", text: `  ${"x".repeat(2_000)}  ` });
    expect(pins.entries[0].text).toHaveLength(500);
  });

  it("ignores malformed stored data instead of failing", () => {
    const storage = memoryStorage({
      "daisyclaw:pinned-messages:s1": JSON.stringify([
        3,
        { id: "t:ok", role: "user", text: "kept", pinnedAt: 1 },
        { id: "t:bad", role: "robot", text: "dropped", pinnedAt: 1 },
      ]),
    });
    const pins = new PinnedMessages("s1", storage);
    expect(pins.entries.map((entry) => entry.id)).toEqual(["t:ok"]);
    expect(
      new PinnedMessages("s2", memoryStorage({ "daisyclaw:pinned-messages:s2": "{" })).size,
    ).toBe(0);
  });
});
