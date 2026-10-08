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
import { formatSpendingLimit } from "./spending-currency.js";

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
  /**
   * Replies this month that used tokens on a model with no known price, so the
   * real total is higher than `spentUsd` by an unknown amount.
   */
  unpricedReplies: number;
};

/** Warn once four fifths of the month's allowance is gone. */
const NEAR_LIMIT_FRACTION = 0.8;

type MonthToDate = { spentUsd: number; unpricedReplies: number };

let cache: ({ key: string; loadedAtMs: number } & MonthToDate) | null = null;

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

async function loadMonthToDate(params: {
  cfg?: DaisyClawConfig;
  nowMs: number;
}): Promise<MonthToDate> {
  const periodStartMs = resolveMonthStartMs(params.nowMs);
  const key = String(periodStartMs);
  if (cache && cache.key === key && params.nowMs - cache.loadedAtMs < SPEND_CACHE_TTL_MS) {
    return { spentUsd: cache.spentUsd, unpricedReplies: cache.unpricedReplies };
  }
  const summary = await loadCostUsageSummary({
    startMs: periodStartMs,
    endMs: params.nowMs,
    ...(params.cfg ? { config: params.cfg } : {}),
  });
  const spentUsd = Number.isFinite(summary.totals.totalCost) ? summary.totals.totalCost : 0;
  const unpricedReplies = Number.isFinite(summary.totals.missingCostEntries)
    ? summary.totals.missingCostEntries
    : 0;
  cache = { key, loadedAtMs: params.nowMs, spentUsd, unpricedReplies };
  return { spentUsd, unpricedReplies };
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
  let unpricedReplies = 0;
  try {
    ({ spentUsd, unpricedReplies } = await loadMonthToDate({
      ...(params.cfg ? { cfg: params.cfg } : {}),
      nowMs,
    }));
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
      unpricedReplies,
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
    unpricedReplies,
  };
}

/**
 * The sentence shown to the user when their own ceiling stops a request, with
 * the limit in the currency and amount they typed.
 */
export function describeSpendingLimitReached(
  status: SpendingStatus,
  cfg?: DaisyClawConfig,
): string {
  const limit =
    status.limitUsd == null
      ? "your limit"
      : formatSpendingLimit({ cfg, limitUsd: status.limitUsd, locale: systemLocale() });
  return (
    `You've reached the monthly limit you set (${limit}). ` +
    "Daisy has stopped making paid requests. You can raise the limit in Settings, " +
    "and it resets at the start of next month."
  );
}

function systemLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}
