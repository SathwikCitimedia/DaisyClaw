// Gateway memory-pressure watchdog: turns diagnostic memory-pressure events
// into graceful self-restarts so a leaking process recovers before it stalls
// message delivery or crashes with an out-of-memory error.
//
// Policy (config: diagnostics.memoryPressureAutoRestart / memoryPressureWarningHoldMs):
// - critical pressure  -> schedule a restart immediately
// - warning pressure   -> schedule a restart only after it persists for the
//                         hold window (a warning that GC never clears is a leak)
// Restarts go through scheduleGatewaySigusr1Restart, which drains idle
// sessions first, coalesces duplicates, and applies its own cooldown. On top
// of that we rate-limit auto-restarts so a fast re-leak cannot flap the
// gateway in a loop.
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import {
  onInternalDiagnosticEvent,
  type DiagnosticMemoryPressureEvent,
} from "../infra/diagnostic-events.js";
import { scheduleGatewaySigusr1Restart } from "../infra/restart.js";
import { createSubsystemLogger } from "../logging/subsystem.js";

const log = createSubsystemLogger("gateway").child("memory-watchdog");

const DEFAULT_WARNING_HOLD_MS = 10 * 60 * 1000;
// Pressure events repeat at most every ~5 minutes while pressure persists
// (see pressureRepeatMs in logging/diagnostic-memory.ts); a longer silence
// means the pressure cleared and the warning window should start over.
const WARNING_STALE_RESET_MS = 15 * 60 * 1000;
const MIN_AUTO_RESTART_INTERVAL_MS = 30 * 60 * 1000;

export type MemoryPressureWatchdogParams = {
  getConfig: () => DaisyClawConfig | null | undefined;
  /** Test seam: restart scheduler. Defaults to scheduleGatewaySigusr1Restart. */
  scheduleRestart?: (opts: { reason?: string }) => unknown;
  /** Test seam: clock. Defaults to Date.now. */
  now?: () => number;
  /** Test seam: event subscription. Defaults to onInternalDiagnosticEvent. */
  subscribe?: (listener: (event: unknown) => void) => () => void;
};

function isMemoryPressureEvent(event: unknown): event is DiagnosticMemoryPressureEvent {
  return (
    typeof event === "object" &&
    event !== null &&
    (event as { type?: unknown }).type === "diagnostic.memory.pressure"
  );
}

function formatMiB(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MiB`;
}

let activeStop: (() => void) | null = null;

export function startMemoryPressureWatchdog(params: MemoryPressureWatchdogParams): () => void {
  // The gateway run loop re-runs startup on every in-process restart; replace
  // any previous subscription instead of stacking listeners.
  activeStop?.();

  const now = params.now ?? Date.now;
  const scheduleRestart = params.scheduleRestart ?? scheduleGatewaySigusr1Restart;
  const subscribe =
    params.subscribe ??
    ((listener: (event: unknown) => void) => onInternalDiagnosticEvent(listener));

  let firstWarningAt: number | null = null;
  let lastWarningAt: number | null = null;
  let lastAutoRestartAt: number | null = null;

  const triggerRestart = (event: DiagnosticMemoryPressureEvent, detail: string) => {
    const ts = now();
    if (lastAutoRestartAt !== null && ts - lastAutoRestartAt < MIN_AUTO_RESTART_INTERVAL_MS) {
      log.warn(
        `memory pressure ${event.level} (${event.reason}) persists but auto-restart is rate-limited; last auto-restart ${Math.round((ts - lastAutoRestartAt) / 1000)}s ago`,
      );
      return;
    }
    lastAutoRestartAt = ts;
    firstWarningAt = null;
    lastWarningAt = null;
    log.warn(
      `memory pressure ${event.level} (${event.reason}) rss=${formatMiB(event.memory.rssBytes)} heap=${formatMiB(event.memory.heapUsedBytes)}: ${detail}; scheduling graceful gateway restart`,
    );
    scheduleRestart({ reason: `memory-pressure:${event.level}` });
  };

  const handleEvent = (event: unknown) => {
    if (!isMemoryPressureEvent(event)) {
      return;
    }
    const diagnostics = params.getConfig()?.diagnostics;
    if (diagnostics?.memoryPressureAutoRestart === false) {
      return;
    }
    if (event.level === "critical") {
      triggerRestart(event, "critical threshold reached");
      return;
    }
    // warning level: restart only when the pressure holds for the full window.
    const holdMs =
      typeof diagnostics?.memoryPressureWarningHoldMs === "number" &&
      Number.isFinite(diagnostics.memoryPressureWarningHoldMs)
        ? diagnostics.memoryPressureWarningHoldMs
        : DEFAULT_WARNING_HOLD_MS;
    if (holdMs <= 0) {
      return;
    }
    const ts = now();
    if (
      firstWarningAt === null ||
      (lastWarningAt !== null && ts - lastWarningAt > WARNING_STALE_RESET_MS)
    ) {
      firstWarningAt = ts;
    }
    lastWarningAt = ts;
    if (ts - firstWarningAt >= holdMs) {
      triggerRestart(
        event,
        `warning pressure held for ${Math.round((ts - firstWarningAt) / 1000)}s`,
      );
    }
  };

  const unsubscribe = subscribe(handleEvent);
  const stop = () => {
    unsubscribe();
    if (activeStop === stop) {
      activeStop = null;
    }
  };
  activeStop = stop;
  return stop;
}
