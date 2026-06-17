// Discord API module exposes the plugin public contract.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
import { inspectDiscordAccount } from "./src/account-inspect.js";

export function inspectDiscordReadOnlyAccount(cfg: DaisyClawConfig, accountId?: string | null) {
  return inspectDiscordAccount({ cfg, accountId });
}
