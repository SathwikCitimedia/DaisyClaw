import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cancelPaletteChatSearch,
  IDLE_PALETTE_CHAT_SEARCH,
  schedulePaletteChatSearch,
  type PaletteChatSearchHost,
} from "./chat-search.ts";

function host(request: (method: string, params?: unknown) => Promise<unknown>) {
  const value: PaletteChatSearchHost & { updates: number } = {
    client: { request: request as NonNullable<PaletteChatSearchHost["client"]>["request"] },
    connected: true,
    paletteChatSearch: IDLE_PALETTE_CHAT_SEARCH,
    hello: { features: { methods: ["chat.search"] } },
    updates: 0,
    requestUpdate: () => {
      value.updates += 1;
    },
  };
  return value;
}

describe("palette chat search", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits for typing to pause, then searches once", async () => {
    const request = vi.fn().mockResolvedValue({
      results: [{ sessionKey: "s1", role: "user", snippet: "my passport" }],
      truncated: false,
    });
    const h = host(request);
    schedulePaletteChatSearch(h, "pa");
    schedulePaletteChatSearch(h, "pass");
    schedulePaletteChatSearch(h, "passport");
    expect(h.paletteChatSearch.status).toBe("loading");
    expect(request).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("chat.search", { query: "passport", limit: 20 });
    expect(h.paletteChatSearch).toEqual({
      query: "passport",
      status: "done",
      results: [{ sessionKey: "s1", role: "user", snippet: "my passport" }],
      truncated: false,
    });
    expect(h.updates).toBe(1);
  });

  it("drops an answer that arrives after the query changed", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ results: [], truncated: false });
    const h = host(request);
    schedulePaletteChatSearch(h, "visa");
    await vi.advanceTimersByTimeAsync(300);
    schedulePaletteChatSearch(h, "visa photo");
    resolveFirst({ results: [{ sessionKey: "old", role: "user", snippet: "visa" }] });
    await vi.advanceTimersByTimeAsync(300);
    expect(h.paletteChatSearch.query).toBe("visa photo");
    expect(h.paletteChatSearch.results).toEqual([]);
  });

  it("does not search one letter, and stays quiet when the engine has no search", async () => {
    const request = vi.fn();
    const h = host(request);
    schedulePaletteChatSearch(h, "a");
    expect(h.paletteChatSearch.status).toBe("idle");

    h.hello = { features: { methods: ["chat.history"] } };
    schedulePaletteChatSearch(h, "passport");
    expect(h.paletteChatSearch.status).toBe("unsupported");
    await vi.advanceTimersByTimeAsync(300);
    expect(request).not.toHaveBeenCalled();
  });

  it("reports a failure instead of spinning", async () => {
    const h = host(vi.fn().mockRejectedValue(new Error("gateway timeout")));
    schedulePaletteChatSearch(h, "passport");
    await vi.advanceTimersByTimeAsync(300);
    expect(h.paletteChatSearch.status).toBe("error");

    const old = host(vi.fn().mockRejectedValue(new Error("unknown method: chat.search")));
    old.hello = null;
    schedulePaletteChatSearch(old, "passport");
    await vi.advanceTimersByTimeAsync(300);
    expect(old.paletteChatSearch.status).toBe("unsupported");
  });

  it("clears when the box closes, and never leaves a search spinning offline", async () => {
    const request = vi.fn();
    const h = host(request);
    schedulePaletteChatSearch(h, "passport");
    cancelPaletteChatSearch(h);
    await vi.advanceTimersByTimeAsync(300);
    expect(request).not.toHaveBeenCalled();
    expect(h.paletteChatSearch).toBe(IDLE_PALETTE_CHAT_SEARCH);

    schedulePaletteChatSearch(h, "passport");
    h.connected = false;
    await vi.advanceTimersByTimeAsync(300);
    expect(h.paletteChatSearch.status).toBe("idle");
  });
});
