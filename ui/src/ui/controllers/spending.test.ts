import { afterEach, describe, expect, it, vi } from "vitest";
import type { GatewayBrowserClient } from "../gateway.ts";
import {
  loadSpending,
  saveSpendingCurrency,
  saveSpendingLimit,
  type SpendingState,
} from "./spending.ts";

const RUPEES = {
  currency: "INR",
  source: "detected",
  usdRate: 96.3,
  rateDate: "2026-10-05",
  locale: "en-IN",
  rates: { USD: 1, INR: 96.3, EUR: 0.9 },
  monthlyLimit: null,
};

function makeState(request: ReturnType<typeof vi.fn>): SpendingState {
  return {
    client: { request } as unknown as GatewayBrowserClient,
    connected: true,
    spendingStatus: null,
    spendingLoad: "idle",
    spendingSave: "idle",
  };
}

function patchOf(request: ReturnType<typeof vi.fn>) {
  const call = request.mock.calls.find((entry) => entry[0] === "config.patch");
  const params = call?.[1] as { raw?: string; replacePaths?: string[] } | undefined;
  return { patch: JSON.parse(params?.raw ?? "{}"), replacePaths: params?.replacePaths ?? [] };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("spending controller", () => {
  it("reads the month's spend, the ceiling and the currency to show them in", async () => {
    const request = vi.fn(async () => ({
      spentUsd: 3.4,
      limitUsd: 10.38,
      exceeded: false,
      nearLimit: false,
      display: { ...RUPEES, monthlyLimit: 1000 },
      costReporting: { state: "counted" },
    }));
    const state = makeState(request);
    await loadSpending(state);
    expect(state.spendingLoad).toBe("idle");
    expect(state.spendingStatus).toMatchObject({
      spentUsd: 3.4,
      limitUsd: 10.38,
      display: { currency: "INR", usdRate: 96.3, monthlyLimit: 1000 },
      costReporting: { state: "counted" },
    });
  });

  it("tells the engine where the viewer is, so it can pick their currency", async () => {
    const request = vi.fn(async () => ({ spentUsd: 0, limitUsd: null }));
    await loadSpending(makeState(request));
    const params = request.mock.calls[0]?.[1] as { timeZone?: string; locale?: string };
    expect(typeof params.timeZone).toBe("string");
    expect(typeof params.locale).toBe("string");
  });

  it("shows an older engine's dollars as dollars", async () => {
    const state = makeState(vi.fn(async () => ({ spentUsd: 12.5, limitUsd: 40, exceeded: false })));
    await loadSpending(state);
    expect(state.spendingStatus?.display).toMatchObject({ currency: "USD", monthlyLimit: 40 });
  });

  it("carries through that the model's spending cannot be counted", async () => {
    const state = makeState(
      vi.fn(async () => ({
        spentUsd: 0,
        limitUsd: null,
        display: RUPEES,
        costReporting: { state: "unpriced-model", model: "Claude Sonnet 4.5" },
      })),
    );
    await loadSpending(state);
    expect(state.spendingStatus?.costReporting).toEqual({
      state: "unpriced-model",
      model: "Claude Sonnet 4.5",
    });
  });

  it("hides the card on an engine that has no spending figure", async () => {
    const state = makeState(
      vi.fn(async () => {
        throw new Error("unknown method: usage.spending");
      }),
    );
    await loadSpending(state);
    expect(state.spendingLoad).toBe("unsupported");
    expect(state.spendingStatus).toBeNull();
  });

  it("says loading failed instead of showing a blank", async () => {
    const state = makeState(
      vi.fn(async () => {
        throw new Error("gateway request timed out");
      }),
    );
    await loadSpending(state);
    expect(state.spendingLoad).toBe("error");
  });

  it("saves a limit typed in rupees as the dollar ceiling, keeping the typed number", async () => {
    const request = vi.fn(async (method: string) =>
      method === "config.patch"
        ? { ok: true }
        : { spentUsd: 0, limitUsd: 10.3842, display: RUPEES },
    );
    const state = makeState(request);
    state.spendingStatus = {
      spentUsd: 0,
      limitUsd: null,
      exceeded: false,
      nearLimit: false,
      display: RUPEES as never,
      costReporting: { state: "counted" },
    };
    await saveSpendingLimit(state, 1000);
    const { patch, replacePaths } = patchOf(request);
    expect(patch).toEqual({
      spending: { monthlyLimitUsd: 10.3842, monthlyLimit: 1000, currency: "INR" },
    });
    expect(replacePaths).toEqual([
      "spending.monthlyLimitUsd",
      "spending.monthlyLimit",
      "spending.currency",
    ]);
    expect(state.spendingSave).toBe("saved");
  });

  it("lets the saved notice go after a moment", async () => {
    vi.useFakeTimers();
    const request = vi.fn(async (method: string) =>
      method === "config.patch" ? { ok: true } : { spentUsd: 0, limitUsd: null },
    );
    const state = makeState(request);
    await saveSpendingLimit(state, 25);
    expect(state.spendingSave).toBe("saved");
    vi.advanceTimersByTime(3_000);
    expect(state.spendingSave).toBe("idle");
  });

  it("clears the limit when the box is emptied", async () => {
    const request = vi.fn(async (method: string) =>
      method === "config.patch" ? { ok: true } : { spentUsd: 99, limitUsd: null, display: RUPEES },
    );
    const state = makeState(request);
    state.spendingStatus = {
      spentUsd: 99,
      limitUsd: 10,
      exceeded: true,
      nearLimit: false,
      display: { ...RUPEES, monthlyLimit: 963 } as never,
      costReporting: { state: "counted" },
    };
    await saveSpendingLimit(state, null);
    const { patch, replacePaths } = patchOf(request);
    expect(patch).toEqual({ spending: { currency: "INR" } });
    expect(replacePaths).toContain("spending.monthlyLimitUsd");
    expect(state.spendingStatus?.limitUsd).toBeNull();
    expect(state.spendingStatus?.exceeded).toBe(false);
  });

  it("does not save stand-in dollars as the user's currency", async () => {
    const request = vi.fn(async (method: string) =>
      method === "config.patch" ? { ok: true } : { spentUsd: 0, limitUsd: 20 },
    );
    const state = makeState(request);
    state.spendingStatus = {
      spentUsd: 0,
      limitUsd: null,
      exceeded: false,
      nearLimit: false,
      display: {
        ...RUPEES,
        currency: "USD",
        source: "fallback",
        wantedCurrency: "INR",
        usdRate: 1,
        rates: { USD: 1 },
      } as never,
      costReporting: { state: "counted" },
    };
    await saveSpendingLimit(state, 20);
    expect(patchOf(request).patch).toEqual({ spending: { monthlyLimitUsd: 20 } });
  });

  it("keeps the same ceiling when the currency changes, rewritten in the new one", async () => {
    const request = vi.fn(async (method: string) =>
      method === "config.patch" ? { ok: true } : { spentUsd: 0, limitUsd: 10 },
    );
    const state = makeState(request);
    state.spendingStatus = {
      spentUsd: 0,
      limitUsd: 10,
      exceeded: false,
      nearLimit: false,
      display: { ...RUPEES, monthlyLimit: 963 } as never,
      costReporting: { state: "counted" },
    };
    await saveSpendingCurrency(state, "EUR");
    expect(patchOf(request).patch).toEqual({ spending: { currency: "EUR", monthlyLimit: 9 } });
  });
});
