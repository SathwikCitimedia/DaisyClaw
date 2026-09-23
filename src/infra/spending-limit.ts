/**
 * Monthly spending guard.
 *
 * The user pays their AI provider directly, with their own key, so this is not
 * billing. It is the ceiling they set on their own bill. Before this existed
 * nothing in the product bounded spend at all: a stuck conversation or a
 * scheduled job could run all night, and the first the user would know of it
 * was a statement weeks later.
 *
 * The engine already records real dollar costs per run. This reads the current
 * calendar month's total and compares it with the limit, cheaply enough to sit
 * in front of every paid request.
 */
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { loadCostUsageSummary } from "./session-cost-usage.js";

/**
 * How long a month-to-date total is reused before it is recomputed. Spend only
 * moves when a request completes, and the guard is allowed to be a little
 * behind: the alternative is re-reading usage on every keystroke-driven send.
 */
const SPEND_CACHE_TTL_MS = 60_000;

export type SpendingStatus = {
  /** The configured ceiling, or null when the user has not set one. */
  limitUsd: number | null;
  /** Spent so far this calendar month, in dollars. */
  spentUsd: number;
  /** What is left before the ceiling, or null when there is no ceiling. */
  remainingUsd: number | null;
  /** True once spending has reached the ceiling. */
  exceeded: boolean;
  /** True when the user is close enough to warn but has not stopped. */
  nearLimit: boolean;
  /** Start of the month this total covers. */
  periodStartMs: number;
};

/** Warn once four fifths of the month's allowance is gone. */
const NEAR_LIMIT_FRACTION = 0.8;

let cache: { key: string; loadedAtMs: number; spentUsd: number } | null = null;

/** Test seam: forget the cached month-to-date total. */
export function resetSpendingCacheForTest(): void {
  cache = null;
}

/** The configured ceiling in dollars, or null when there is none. */
export function readMonthlyLimitUsd(cfg: DaisyClawConfig | undefined): number | null {
  const raw = cfg?.spending?.monthlyLimitUsd;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return null;
  }
  return raw;
}

/** Midnight on the first of the month containing `nowMs`, in local time. */
export function resolveMonthStartMs(nowMs: number): number {
  const start = new Date(nowMs);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

async function loadMonthToDateSpendUsd(params: {
  cfg?: DaisyClawConfig;
  nowMs: number;
}): Promise<number> {
  const periodStartMs = resolveMonthStartMs(params.nowMs);
  const key = String(periodStartMs);
  if (cache && cache.key === key && params.nowMs - cache.loadedAtMs < SPEND_CACHE_TTL_MS) {
    return cache.spentUsd;
  }
  const summary = await loadCostUsageSummary({
    startMs: periodStartMs,
    endMs: params.nowMs,
    ...(params.cfg ? { config: params.cfg } : {}),
  });
  const spentUsd = Number.isFinite(summary.totals.totalCost) ? summary.totals.totalCost : 0;
  cache = { key, loadedAtMs: params.nowMs, spentUsd };
  return spentUsd;
}

/**
 * Where the user stands against their own ceiling. Never throws: a guard that
 * fails to read usage must not be the reason a message cannot be sent, so an
 * unreadable total is treated as nothing spent.
 */
export async function evaluateSpending(params: {
  cfg?: DaisyClawConfig;
  nowMs?: number;
}): Promise<SpendingStatus> {
  const nowMs = params.nowMs ?? Date.now();
  const periodStartMs = resolveMonthStartMs(nowMs);
  const limitUsd = readMonthlyLimitUsd(params.cfg);
  let spentUsd: number;
  try {
    spentUsd = await loadMonthToDateSpendUsd({ ...(params.cfg ? { cfg: params.cfg } : {}), nowMs });
  } catch {
    // A guard that cannot read usage must never be the reason a message fails.
    spentUsd = 0;
  }
  if (limitUsd == null) {
    return {
      limitUsd: null,
      spentUsd,
      remainingUsd: null,
      exceeded: false,
      nearLimit: false,
      periodStartMs,
    };
  }
  const remainingUsd = Math.max(0, limitUsd - spentUsd);
  return {
    limitUsd,
    spentUsd,
    remainingUsd,
    exceeded: spentUsd >= limitUsd,
    nearLimit: spentUsd >= limitUsd * NEAR_LIMIT_FRACTION && spentUsd < limitUsd,
    periodStartMs,
  };
}

/** The sentence shown to the user when their own ceiling stops a request. */
export function describeSpendingLimitReached(status: SpendingStatus): string {
  const limit = status.limitUsd == null ? "your limit" : `$${status.limitUsd.toFixed(2)}`;
  return (
    `You've reached the monthly limit you set (${limit}). ` +
    "Daisy has stopped making paid requests. You can raise the limit in Settings, " +
    "and it resets at the start of next month."
  );
}
