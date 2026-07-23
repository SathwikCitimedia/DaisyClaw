// Tests cover memory-pressure watchdog restart policy.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { startMemoryPressureWatchdog } from "./memory-pressure-watchdog.js";

const MB = 1024 * 1024;
const MINUTE_MS = 60 * 1000;

function pressureEvent(level: "warning" | "critical") {
  return {
    type: "diagnostic.memory.pressure",
    level,
    reason: "rss_threshold",
    memory: {
      rssBytes: level === "critical" ? 3200 * MB : 1600 * MB,
      heapTotalBytes: 1500 * MB,
      heapUsedBytes: 1200 * MB,
      externalBytes: 0,
      arrayBuffersBytes: 0,
    },
    thresholdBytes: level === "critical" ? 3072 * MB : 1536 * MB,
  };
}

function createHarness(config?: DaisyClawConfig) {
  let nowMs = 1_000_000;
  let listener: ((event: unknown) => void) | null = null;
  const scheduleRestart = vi.fn();
  const stop = startMemoryPressureWatchdog({
    getConfig: () => config ?? ({} as DaisyClawConfig),
    scheduleRestart,
    now: () => nowMs,
    subscribe: (next) => {
      listener = next;
      return () => {
        listener = null;
      };
    },
  });
  return {
    scheduleRestart,
    stop,
    emit: (event: unknown) => listener?.(event),
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

describe("memory pressure watchdog", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("schedules a restart immediately on critical pressure", () => {
    const harness = createHarness();
    harness.emit(pressureEvent("critical"));
    expect(harness.scheduleRestart).toHaveBeenCalledWith({ reason: "memory-pressure:critical" });
    harness.stop();
  });

  it("rate-limits repeated critical restarts", () => {
    const harness = createHarness();
    harness.emit(pressureEvent("critical"));
    harness.advance(5 * MINUTE_MS);
    harness.emit(pressureEvent("critical"));
    expect(harness.scheduleRestart).toHaveBeenCalledTimes(1);
    harness.advance(31 * MINUTE_MS);
    harness.emit(pressureEvent("critical"));
    expect(harness.scheduleRestart).toHaveBeenCalledTimes(2);
    harness.stop();
  });

  it("restarts on warning pressure only after it holds for the window", () => {
    const harness = createHarness();
    harness.emit(pressureEvent("warning"));
    expect(harness.scheduleRestart).not.toHaveBeenCalled();
    harness.advance(5 * MINUTE_MS);
    harness.emit(pressureEvent("warning"));
    expect(harness.scheduleRestart).not.toHaveBeenCalled();
    harness.advance(6 * MINUTE_MS);
    harness.emit(pressureEvent("warning"));
    expect(harness.scheduleRestart).toHaveBeenCalledWith({ reason: "memory-pressure:warning" });
    harness.stop();
  });

  it("resets the warning window when pressure clears between events", () => {
    const harness = createHarness();
    harness.emit(pressureEvent("warning"));
    // A long silence means pressure cleared; the next warning starts fresh.
    harness.advance(20 * MINUTE_MS);
    harness.emit(pressureEvent("warning"));
    harness.advance(5 * MINUTE_MS);
    harness.emit(pressureEvent("warning"));
    expect(harness.scheduleRestart).not.toHaveBeenCalled();
    harness.stop();
  });

  it("does nothing when auto-restart is disabled in config", () => {
    const harness = createHarness({
      diagnostics: { memoryPressureAutoRestart: false },
    } as DaisyClawConfig);
    harness.emit(pressureEvent("critical"));
    expect(harness.scheduleRestart).not.toHaveBeenCalled();
    harness.stop();
  });

  it("skips warning-hold restarts when the hold window is 0", () => {
    const harness = createHarness({
      diagnostics: { memoryPressureWarningHoldMs: 0 },
    } as DaisyClawConfig);
    harness.emit(pressureEvent("warning"));
    harness.advance(60 * MINUTE_MS);
    harness.emit(pressureEvent("warning"));
    expect(harness.scheduleRestart).not.toHaveBeenCalled();
    // Critical still restarts.
    harness.emit(pressureEvent("critical"));
    expect(harness.scheduleRestart).toHaveBeenCalledTimes(1);
    harness.stop();
  });

  it("ignores unrelated diagnostic events", () => {
    const harness = createHarness();
    harness.emit({ type: "diagnostic.memory.sample" });
    harness.emit(null);
    expect(harness.scheduleRestart).not.toHaveBeenCalled();
    harness.stop();
  });
});
