// Slack API module exposes the plugin public contract.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
import { inspectSlackAccount } from "./src/account-inspect.js";

export function inspectSlackReadOnlyAccount(cfg: DaisyClawConfig, accountId?: string | null) {
  return inspectSlackAccount({ cfg, accountId });
}
