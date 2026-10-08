// Control UI controller: what the user has spent this month, and their ceiling.
//
// The money goes straight to their own AI provider. This is not a bill from us,
// it is the only price they pay for the product, and it used to be invisible
// until a card statement arrived weeks later.
//
// Providers bill in US dollars and the limit is enforced in dollars. Everything
// the user sees and types is in their own currency, converted at the day's rate.
import type { GatewayBrowserClient } from "../gateway.ts";

export type SpendingDisplay = {
  /** ISO 4217 code amounts are shown in. */
  currency: string;
  source: "chosen" | "detected" | "fallback";
  /** The currency that could not be shown yet, when `source` is fallback. */
  wantedCurrency?: string;
  /** Units of `currency` per US dollar. */
  usdRate: number;
  rateDate: string | null;
  /** Locale amounts are written in, e.g. "en-IN". */
  locale: string;
  /** Units per US dollar for every currency on offer, dollars included. */
  rates: Record<string, number>;
  /** The limit in `currency`, as the user typed it. */
  monthlyLimit: number | null;
};

export type SpendingCostReporting =
  | { state: "counted" }
  | { state: "partial"; unpricedReplies: number }
  | { state: "unpriced-model"; model: string };

export type SpendingStatus = {
  spentUsd: number;
  limitUsd: number | null;
  exceeded: boolean;
  nearLimit: boolean;
  display: SpendingDisplay;
  costReporting: SpendingCostReporting;
};

export type SpendingLoadState = "idle" | "loading" | "error" | "unsupported";
export type SpendingSaveState = "idle" | "saving" | "saved" | "error";

export type SpendingState = {
  client: GatewayBrowserClient | null;
  connected?: boolean;
  spendingStatus: SpendingStatus | null;
  spendingLoad: SpendingLoadState;
  spendingSave: SpendingSaveState;
};

/** How long "Saved" stays next to the limit before it quietly goes. */
const SAVED_NOTICE_MS = 2_500;

const DOLLARS: SpendingDisplay = {
  currency: "USD",
  source: "detected",
  usdRate: 1,
  rateDate: null,
  locale: "en-US",
  rates: { USD: 1 },
  monthlyLimit: null,
};

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readDisplay(value: unknown, limitUsd: number | null): SpendingDisplay {
  if (!value || typeof value !== "object") {
    // An engine from before currencies: show its dollars as dollars.
    return { ...DOLLARS, monthlyLimit: limitUsd };
  }
  const record = value as Partial<SpendingDisplay>;
  const currency = typeof record.currency === "string" ? record.currency : "USD";
  const usdRate = asFiniteNumber(record.usdRate) ?? 1;
  return {
    currency,
    source: record.source === "chosen" || record.source === "fallback" ? record.source : "detected",
    ...(typeof record.wantedCurrency === "string" ? { wantedCurrency: record.wantedCurrency } : {}),
    usdRate,
    rateDate: typeof record.rateDate === "string" ? record.rateDate : null,
    locale: typeof record.locale === "string" ? record.locale : "en-US",
    rates:
      record.rates && typeof record.rates === "object"
        ? { USD: 1, ...record.rates }
        : { USD: 1, [currency]: usdRate },
    monthlyLimit:
      asFiniteNumber(record.monthlyLimit) ??
      (limitUsd == null ? null : Math.round(limitUsd * usdRate * 100) / 100),
  };
}

function readCostReporting(value: unknown): SpendingCostReporting {
  const record = (value ?? {}) as { state?: unknown; unpricedReplies?: unknown; model?: unknown };
  if (record.state === "unpriced-model" && typeof record.model === "string") {
    return { state: "unpriced-model", model: record.model };
  }
  if (record.state === "partial") {
    return { state: "partial", unpricedReplies: asFiniteNumber(record.unpricedReplies) ?? 0 };
  }
  return { state: "counted" };
}

function readStatus(payload: unknown): SpendingStatus {
  const record = (payload ?? {}) as Record<string, unknown>;
  const limitUsd = asFiniteNumber(record.limitUsd);
  return {
    spentUsd: asFiniteNumber(record.spentUsd) ?? 0,
    limitUsd,
    exceeded: record.exceeded === true,
    nearLimit: record.nearLimit === true,
    display: readDisplay(record.display, limitUsd),
    costReporting: readCostReporting(record.costReporting),
  };
}

function viewerLocation(): { timeZone?: string; locale?: string } {
  try {
    const options = Intl.DateTimeFormat().resolvedOptions();
    const locale =
      typeof navigator !== "undefined" && navigator.language ? navigator.language : options.locale;
    return { timeZone: options.timeZone, locale };
  } catch {
    return {};
  }
}

function isUnknownMethod(err: unknown): boolean {
  return /unknown method/i.test(String(err instanceof Error ? err.message : err));
}

/** Reads the month's spend, the ceiling and how to show them into view state. */
export async function loadSpending(state: SpendingState): Promise<void> {
  if (!state.client || state.connected === false) {
    return;
  }
  state.spendingLoad = "loading";
  try {
    const payload = await state.client.request("usage.spending", viewerLocation());
    state.spendingStatus = readStatus(payload);
    state.spendingLoad = "idle";
  } catch (err) {
    // An engine without the method is older, and has no figure to show.
    state.spendingLoad = isUnknownMethod(err) ? "unsupported" : "error";
  }
}

function roundTo(amount: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(amount * factor) / factor;
}

async function patchSpending(
  state: SpendingState,
  spending: Record<string, unknown>,
  replacePaths: string[],
): Promise<void> {
  await state.client?.request("config.patch", {
    raw: JSON.stringify({ spending }),
    replacePaths: replacePaths.map((key) => `spending.${key}`),
  });
}

function showSavedThenSettle(state: SpendingState, onChange?: () => void) {
  state.spendingSave = "saved";
  setTimeout(() => {
    if (state.spendingSave === "saved") {
      state.spendingSave = "idle";
      onChange?.();
    }
  }, SAVED_NOTICE_MS);
}

/**
 * Saves the ceiling the user typed, in the currency they see. The dollar figure
 * the engine enforces is worked out from today's rate; the typed number is kept
 * as typed. `null` clears the limit, which is how emptying the box says "none".
 */
export async function saveSpendingLimit(
  state: SpendingState,
  amount: number | null,
  onChange?: () => void,
): Promise<void> {
  if (!state.client) {
    return;
  }
  const display = state.spendingStatus?.display ?? DOLLARS;
  // Dollars shown only because today's rate is missing are not a choice, so
  // neither they nor a dollar amount typed in them is saved as the user's
  // currency; it returns with the rate, showing the same ceiling converted.
  const fallback = display.source === "fallback";
  const typed = fallback ? {} : { currency: display.currency };
  state.spendingSave = "saving";
  onChange?.();
  try {
    await patchSpending(
      state,
      amount == null
        ? typed
        : {
            monthlyLimitUsd: roundTo(amount / display.usdRate, 4),
            ...(fallback ? {} : { monthlyLimit: amount }),
            ...typed,
          },
      ["monthlyLimitUsd", "monthlyLimit", ...Object.keys(typed)],
    );
    await loadSpending(state);
    showSavedThenSettle(state, onChange);
  } catch {
    state.spendingSave = "error";
  }
  onChange?.();
}

/**
 * Switches the currency amounts are shown in. A limit stays the same dollar
 * ceiling and is rewritten in the new currency, so nothing is enforced
 * differently just because the user changed how they read it.
 */
export async function saveSpendingCurrency(
  state: SpendingState,
  currency: string,
  onChange?: () => void,
): Promise<void> {
  const status = state.spendingStatus;
  const rate = status?.display.rates[currency];
  if (!state.client || !status || rate === undefined || currency === status.display.currency) {
    return;
  }
  state.spendingSave = "saving";
  onChange?.();
  try {
    await patchSpending(
      state,
      {
        currency,
        ...(status.limitUsd == null ? {} : { monthlyLimit: roundTo(status.limitUsd * rate, 2) }),
      },
      ["currency", "monthlyLimit"],
    );
    await loadSpending(state);
    showSavedThenSettle(state, onChange);
  } catch {
    state.spendingSave = "error";
  }
  onChange?.();
}
