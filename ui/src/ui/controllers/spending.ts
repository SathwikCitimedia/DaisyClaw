// Control UI controller: what the user has spent this month, and their ceiling.
//
// The money goes straight to their own AI provider. This is not a bill from us,
// it is the only price they pay for the product, and it used to be invisible
// until a card statement arrived weeks later.
import type { GatewayBrowserClient } from "../gateway.ts";

export type SpendingState = {
  client: GatewayBrowserClient | null;
  connected?: boolean;
  spendingThisMonthUsd: number | null;
  spendingLimitUsd: number | null;
  spendingExceeded: boolean;
};

type SpendingStatusPayload = {
  spentUsd?: unknown;
  limitUsd?: unknown;
  exceeded?: unknown;
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Reads the month's spend and the configured ceiling into view state. */
export async function loadSpending(state: SpendingState): Promise<void> {
  if (!state.client || state.connected === false) {
    return;
  }
  try {
    const status = (await state.client.request(
      "usage.spending",
      {},
    )) as SpendingStatusPayload | null;
    state.spendingThisMonthUsd = asFiniteNumber(status?.spentUsd);
    state.spendingLimitUsd = asFiniteNumber(status?.limitUsd);
    state.spendingExceeded = status?.exceeded === true;
  } catch {
    // An engine that does not know the method is simply older. Leaving the
    // figures null hides the card rather than showing a wrong number.
  }
}

/**
 * Saves the ceiling. `null` clears it, which is how the user says "no limit"
 * by emptying the box.
 */
export async function saveSpendingLimit(
  state: SpendingState,
  limitUsd: number | null,
): Promise<void> {
  if (!state.client) {
    return;
  }
  const patch = { spending: { monthlyLimitUsd: limitUsd ?? undefined } };
  await state.client.request("config.patch", {
    raw: JSON.stringify(patch),
    replacePaths: ["spending.monthlyLimitUsd"],
  });
  state.spendingLimitUsd = limitUsd;
  if (limitUsd == null) {
    state.spendingExceeded = false;
  }
  await loadSpending(state);
}
