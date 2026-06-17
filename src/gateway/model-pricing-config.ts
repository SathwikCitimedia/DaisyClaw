// Gateway model-pricing config helper.
// Resolves whether cost/pricing metadata should be available to Gateway surfaces.
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";

/** Returns whether gateway model pricing/cost metadata should be shown. */
export function isGatewayModelPricingEnabled(config: DaisyClawConfig): boolean {
  return config.models?.pricing?.enabled !== false;
}
