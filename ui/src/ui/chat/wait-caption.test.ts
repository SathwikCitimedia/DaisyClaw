import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelWaitCaptionTick,
  resolveActiveToolLabel,
  resolveRunningToolName,
  resolveWaitCaption,
  resolveWaitProviderName,
  resetWaitClocks,
  scheduleWaitCaptionTick,
  trackWaitElapsedMs,
  WAIT_CAPTION_CONNECTING_MS,
  WAIT_CAPTION_ELAPSED_MS,
  WAIT_CAPTION_STILL_MS,
  WAIT_CAPTION_STOP_HINT_MS,
} from "./wait-caption.ts";

afterEach(() => {
  resetWaitClocks();
  cancelWaitCaptionTick();
});

describe("resolveWaitCaption", () => {
  it("stays silent while the wait is short, so fast models show bare dots", () => {
    expect(resolveWaitCaption({ elapsedMs: 0 })).toBeNull();
    expect(resolveWaitCaption({ elapsedMs: WAIT_CAPTION_CONNECTING_MS - 1 })).toBeNull();
  });

  it("names the provider once connecting takes a moment", () => {
    expect(
      resolveWaitCaption({ elapsedMs: WAIT_CAPTION_CONNECTING_MS, provider: "anthropic" })?.text,
    ).toBe("Connecting to anthropic…");
    expect(resolveWaitCaption({ elapsedMs: WAIT_CAPTION_CONNECTING_MS })?.text).toBe(
      "Connecting to your model…",
    );
  });

  it("counts elapsed seconds against the provider for longer waits", () => {
    expect(resolveWaitCaption({ elapsedMs: 12_400, provider: "litellm" })?.text).toBe(
      "Waiting on litellm · 12s",
    );
    expect(resolveWaitCaption({ elapsedMs: WAIT_CAPTION_ELAPSED_MS })?.text).toBe(
      "Waiting for a reply · 8s",
    );
  });

  it("escalates the wording once the wait gets really long", () => {
    expect(resolveWaitCaption({ elapsedMs: WAIT_CAPTION_STILL_MS, provider: "openai" })?.text).toBe(
      "Still waiting on openai · 25s",
    );
  });

  it("emphasizes stopping only after the long-wait threshold", () => {
    expect(resolveWaitCaption({ elapsedMs: WAIT_CAPTION_STOP_HINT_MS - 1 })?.emphasizeStop).toBe(
      false,
    );
    expect(resolveWaitCaption({ elapsedMs: WAIT_CAPTION_STOP_HINT_MS })?.emphasizeStop).toBe(true);
  });

  it("prefers concrete tool progress immediately, with no threshold", () => {
    const caption = resolveWaitCaption({
      elapsedMs: 200,
      provider: "anthropic",
      activeToolLabel: "Checking memory…",
    });
    expect(caption?.text).toBe("Checking memory…");
  });

  it("treats non-finite elapsed values as zero", () => {
    expect(resolveWaitCaption({ elapsedMs: Number.NaN })).toBeNull();
  });
});

describe("resolveActiveToolLabel", () => {
  it("maps known tools to friendly phrases", () => {
    expect(resolveActiveToolLabel("grep")).toBe("Searching your files…");
    expect(resolveActiveToolLabel("WebSearch")).toBe("Searching the web…");
  });

  it("derives a phrase for skill invocations", () => {
    expect(resolveActiveToolLabel("skill:weather")).toBe("Using weather…");
    expect(resolveActiveToolLabel("skills_quick_notes")).toBe("Using quick notes…");
  });

  it("stays quiet for unknown or empty tools", () => {
    expect(resolveActiveToolLabel("mystery_tool")).toBeNull();
    expect(resolveActiveToolLabel("")).toBeNull();
    expect(resolveActiveToolLabel(null)).toBeNull();
  });
});

describe("resolveRunningToolName", () => {
  it("returns the latest invoked tool that has produced no output", () => {
    expect(resolveRunningToolName([{ toolName: "grep" }])).toBe("grep");
    expect(resolveRunningToolName([{ toolName: "read" }, { tool_name: "bash" }])).toBe("bash");
  });

  it("returns null once the tool reported a result, so it stops narrating", () => {
    expect(resolveRunningToolName([{ toolName: "grep", result: "matches" }])).toBeNull();
    expect(resolveRunningToolName([{ toolName: "grep", role: "tool" }])).toBeNull();
  });

  it("ignores unusable entries", () => {
    expect(resolveRunningToolName([])).toBeNull();
    expect(resolveRunningToolName([null, "text", { role: "assistant" }])).toBeNull();
  });
});

describe("resolveWaitProviderName", () => {
  const sessions = {
    sessions: [{ key: "a", modelProvider: "litellm" }, { key: "b" }],
    defaults: { modelProvider: "anthropic" },
  };

  it("prefers the session's own provider, then the defaults", () => {
    expect(resolveWaitProviderName(sessions, "a")).toBe("litellm");
    expect(resolveWaitProviderName(sessions, "b")).toBe("anthropic");
    expect(resolveWaitProviderName(sessions, "missing")).toBe("anthropic");
  });

  it("returns null when nothing is configured", () => {
    expect(resolveWaitProviderName(null, "a")).toBeNull();
    expect(resolveWaitProviderName({ defaults: { modelProvider: "  " } }, "a")).toBeNull();
  });
});

describe("trackWaitElapsedMs", () => {
  it("starts at zero and grows while awaiting", () => {
    expect(trackWaitElapsedMs("s1", true, 1_000)).toBe(0);
    expect(trackWaitElapsedMs("s1", true, 4_500)).toBe(3_500);
  });

  it("clears the clock when the wait ends, so the next turn restarts at zero", () => {
    trackWaitElapsedMs("s1", true, 1_000);
    expect(trackWaitElapsedMs("s1", false, 5_000)).toBeNull();
    expect(trackWaitElapsedMs("s1", true, 9_000)).toBe(0);
  });

  it("tracks sessions independently", () => {
    trackWaitElapsedMs("s1", true, 1_000);
    expect(trackWaitElapsedMs("s2", true, 6_000)).toBe(0);
    expect(trackWaitElapsedMs("s1", true, 6_000)).toBe(5_000);
  });
});

describe("scheduleWaitCaptionTick", () => {
  it("re-renders once per interval and never stacks timers", () => {
    vi.useFakeTimers();
    try {
      const requestUpdate = vi.fn();
      scheduleWaitCaptionTick(requestUpdate, 1_000);
      scheduleWaitCaptionTick(requestUpdate, 1_000);
      scheduleWaitCaptionTick(requestUpdate, 1_000);
      vi.advanceTimersByTime(1_000);
      expect(requestUpdate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fire after cancellation", () => {
    vi.useFakeTimers();
    try {
      const requestUpdate = vi.fn();
      scheduleWaitCaptionTick(requestUpdate, 1_000);
      cancelWaitCaptionTick();
      vi.advanceTimersByTime(5_000);
      expect(requestUpdate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
