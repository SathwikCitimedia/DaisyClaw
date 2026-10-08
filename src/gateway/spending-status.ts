// What the Settings spending card shows: the month's total, the limit, the
// currency to show them in, and whether the total can be trusted at all.
//
// A total of zero is only true if Daisy can price what the model used. A model
// with no known price (a self-hosted or custom AI server, typically) always
// adds up to zero, and a limit on it can never trigger. Saying so is better
// than a reassuring 0.00 that is not real.
import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { getUsdExchangeRates, type UsdExchangeRates } from "../infra/exchange-rates.js";
import { isModelPricingKnown } from "../infra/session-cost-usage.js";
import { resolveSpendingDisplay, type SpendingDisplay } from "../infra/spending-currency.js";
import { evaluateSpending, type SpendingStatus } from "../infra/spending-limit.js";
import { resolveModelCostConfig } from "../utils/usage-format.js";

export type SpendingCostReporting =
  /** Every reply this month was priced. */
  | { state: "counted" }
  /** Some replies used a model with no known price; the real total is higher. */
  | { state: "partial"; unpricedReplies: number }
  /** The model in use has no known price, so nothing it does can be counted. */
  | { state: "unpriced-model"; model: string };

export type SpendingStatusPayload = SpendingStatus & {
  display: SpendingDisplay;
  costReporting: SpendingCostReporting;
};

function resolveModelLabel(cfg: DaisyClawConfig, provider: string, model: string): string {
  const configured = cfg.models?.providers?.[provider]?.models?.find((entry) => entry.id === model);
  const name = typeof configured?.name === "string" ? configured.name.trim() : "";
  return name || model;
}

/** Whether spending on the default model can be counted, and if not, why. */
export function resolveSpendingCostReporting(params: {
  cfg: DaisyClawConfig;
  unpricedReplies: number;
}): SpendingCostReporting {
  try {
    const ref = resolveDefaultModelForAgent({ cfg: params.cfg, allowPluginNormalization: false });
    const cost = resolveModelCostConfig({
      provider: ref.provider,
      model: ref.model,
      config: params.cfg,
    });
    if (!isModelPricingKnown(cost)) {
      return {
        state: "unpriced-model",
        model: resolveModelLabel(params.cfg, ref.provider, ref.model),
      };
    }
  } catch {
    // An unresolvable model is reported by the model settings, not here.
  }
  if (params.unpricedReplies > 0) {
    return { state: "partial", unpricedReplies: params.unpricedReplies };
  }
  return { state: "counted" };
}

/** Everything the spending card needs, for a viewer in `timeZone` and `locale`. */
export async function buildSpendingStatusPayload(params: {
  cfg: DaisyClawConfig;
  timeZone?: string;
  locale?: string;
  loadRates?: () => Promise<UsdExchangeRates | null>;
}): Promise<SpendingStatusPayload> {
  // Rates first: after the first day they come from disk at once, and the very
  // first fetch must not race the month's usage scan, which can hold the event
  // loop long enough to make the fetch's timer give up on a reply that arrived.
  const rates = await (params.loadRates ?? getUsdExchangeRates)().catch(() => null);
  const status = await evaluateSpending({ cfg: params.cfg });
  return {
    ...status,
    display: resolveSpendingDisplay({
      cfg: params.cfg,
      rates,
      limitUsd: status.limitUsd,
      ...(params.timeZone ? { timeZone: params.timeZone } : {}),
      ...(params.locale ? { locale: params.locale } : {}),
    }),
    costReporting: resolveSpendingCostReporting({
      cfg: params.cfg,
      unpricedReplies: status.unpricedReplies,
    }),
  };
}
