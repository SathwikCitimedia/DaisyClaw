// The user pays their provider directly, so this is their ceiling on their own
// bill. Before it existed nothing bounded spend at all.
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCostUsageSummary = vi.hoisted(() => vi.fn());
vi.mock("./session-cost-usage.js", () => ({ loadCostUsageSummary }));

import {
  describeSpendingLimitReached,
  evaluateSpending,
  readMonthlyLimitUsd,
  resetSpendingCacheForTest,
  resolveMonthStartMs,
} from "./spending-limit.js";

function spent(totalCost: number) {
  loadCostUsageSummary.mockResolvedValue({ totals: { totalCost } });
}

beforeEach(() => {
  resetSpendingCacheForTest();
  loadCostUsageSummary.mockReset();
});

describe("monthly spending limit", () => {
  it("does nothing when the user has not set one", async () => {
    spent(9_999);
    const status = await evaluateSpending({ cfg: {} as never });
    expect(status.limitUsd).toBeNull();
    expect(status.exceeded).toBe(false);
  });

  it("stops once the month's spending reaches the ceiling", async () => {
    spent(20);
    const status = await evaluateSpending({ cfg: { spending: { monthlyLimitUsd: 20 } } as never });
    expect(status.exceeded).toBe(true);
    expect(status.remainingUsd).toBe(0);
  });

  it("warns before it stops", async () => {
    spent(17);
    const status = await evaluateSpending({ cfg: { spending: { monthlyLimitUsd: 20 } } as never });
    expect(status.exceeded).toBe(false);
    expect(status.nearLimit).toBe(true);
    expect(status.remainingUsd).toBeCloseTo(3);
  });

  it("stays out of the way well below the ceiling", async () => {
    spent(1.5);
    const status = await evaluateSpending({ cfg: { spending: { monthlyLimitUsd: 20 } } as never });
    expect(status.exceeded).toBe(false);
    expect(status.nearLimit).toBe(false);
  });

  it("counts only the current calendar month", async () => {
    spent(5);
    const nowMs = new Date(2026, 8, 23, 14, 0, 0).getTime();
    await evaluateSpending({ cfg: { spending: { monthlyLimitUsd: 20 } } as never, nowMs });
    const call = loadCostUsageSummary.mock.calls[0]?.[0];
    expect(call.startMs).toBe(new Date(2026, 8, 1, 0, 0, 0, 0).getTime());
    expect(call.endMs).toBe(nowMs);
  });

  it("never blocks a message because usage could not be read", async () => {
    loadCostUsageSummary.mockRejectedValue(new Error("usage store unavailable"));
    const status = await evaluateSpending({ cfg: { spending: { monthlyLimitUsd: 20 } } as never });
    expect(status.exceeded).toBe(false);
    expect(status.spentUsd).toBe(0);
  });

  it("reuses a recent total instead of re-reading usage on every message", async () => {
    spent(2);
    const nowMs = Date.now();
    await evaluateSpending({ cfg: {} as never, nowMs });
    await evaluateSpending({ cfg: {} as never, nowMs: nowMs + 1_000 });
    expect(loadCostUsageSummary).toHaveBeenCalledTimes(1);
  });

  it("ignores a limit that is zero or nonsense", () => {
    expect(readMonthlyLimitUsd({ spending: { monthlyLimitUsd: 0 } } as never)).toBeNull();
    expect(readMonthlyLimitUsd({ spending: { monthlyLimitUsd: -5 } } as never)).toBeNull();
    expect(readMonthlyLimitUsd({} as never)).toBeNull();
    expect(readMonthlyLimitUsd({ spending: { monthlyLimitUsd: 25 } } as never)).toBe(25);
  });

  it("tells the user what happened and how to undo it", async () => {
    spent(20);
    const status = await evaluateSpending({ cfg: { spending: { monthlyLimitUsd: 20 } } as never });
    const message = describeSpendingLimitReached(status);
    expect(message).toContain("$20.00");
    expect(message).toContain("Settings");
    expect(message.toLowerCase()).toContain("next month");
  });

  it("states the limit in the currency and amount the user typed", async () => {
    spent(12);
    const cfg = { spending: { monthlyLimitUsd: 10.38, currency: "INR", monthlyLimit: 1000 } };
    const status = await evaluateSpending({ cfg: cfg as never });
    expect(describeSpendingLimitReached(status, cfg as never)).toContain("₹1,000.00");
  });

  it("counts replies it could not price, so a total is not trusted blindly", async () => {
    loadCostUsageSummary.mockResolvedValue({ totals: { totalCost: 1.2, missingCostEntries: 3 } });
    const status = await evaluateSpending({ cfg: {} as never });
    expect(status.spentUsd).toBe(1.2);
    expect(status.unpricedReplies).toBe(3);
  });

  it("starts the month at local midnight on the first", () => {
    const start = resolveMonthStartMs(new Date(2026, 8, 23, 14, 30).getTime());
    expect(new Date(start).getDate()).toBe(1);
    expect(new Date(start).getHours()).toBe(0);
  });
});
