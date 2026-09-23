import { describe, expect, it, vi } from "vitest";
import type { GatewayBrowserClient } from "../gateway.ts";
import { loadSpending, saveSpendingLimit, type SpendingState } from "./spending.ts";

function makeState(request: ReturnType<typeof vi.fn>): SpendingState {
  return {
    client: { request } as unknown as GatewayBrowserClient,
    connected: true,
    spendingThisMonthUsd: null,
    spendingLimitUsd: null,
    spendingExceeded: false,
  };
}

describe("spending controller", () => {
  it("reads the month's spend and the ceiling", async () => {
    const state = makeState(vi.fn(async () => ({ spentUsd: 12.5, limitUsd: 40, exceeded: false })));
    await loadSpending(state);
    expect(state.spendingThisMonthUsd).toBe(12.5);
    expect(state.spendingLimitUsd).toBe(40);
    expect(state.spendingExceeded).toBe(false);
  });

  it("carries through that Daisy has stopped", async () => {
    const state = makeState(vi.fn(async () => ({ spentUsd: 40, limitUsd: 40, exceeded: true })));
    await loadSpending(state);
    expect(state.spendingExceeded).toBe(true);
  });

  it("shows nothing rather than a wrong number on an older engine", async () => {
    const state = makeState(
      vi.fn(async () => {
        throw new Error("unknown method: usage.spending");
      }),
    );
    await loadSpending(state);
    expect(state.spendingThisMonthUsd).toBeNull();
    expect(state.spendingLimitUsd).toBeNull();
  });

  it("saves a limit the user typed", async () => {
    const request = vi.fn(async (method: string, _params?: Record<string, unknown>) =>
      method === "config.patch" ? { ok: true } : { spentUsd: 3, limitUsd: 25, exceeded: false },
    );
    const state = makeState(request);
    await saveSpendingLimit(state, 25);
    const patchCall = request.mock.calls.find((call) => call[0] === "config.patch");
    const raw = String((patchCall?.[1] as { raw?: unknown } | undefined)?.raw ?? "{}");
    expect(JSON.parse(raw)).toEqual({ spending: { monthlyLimitUsd: 25 } });
    expect(state.spendingLimitUsd).toBe(25);
  });

  it("clears the limit when the box is emptied, and stops blocking", async () => {
    const request = vi.fn(async (method: string, _params?: Record<string, unknown>) =>
      method === "config.patch" ? { ok: true } : { spentUsd: 99, limitUsd: null, exceeded: false },
    );
    const state = makeState(request);
    state.spendingExceeded = true;
    await saveSpendingLimit(state, null);
    expect(state.spendingLimitUsd).toBeNull();
    expect(state.spendingExceeded).toBe(false);
  });
});
