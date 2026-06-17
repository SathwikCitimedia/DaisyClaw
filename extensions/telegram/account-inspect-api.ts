// Telegram API module exposes the plugin public contract.
import type { DaisyClawConfig } from "./runtime-api.js";
import { inspectTelegramAccount } from "./src/account-inspect.js";

export function inspectTelegramReadOnlyAccount(cfg: DaisyClawConfig, accountId?: string | null) {
  return inspectTelegramAccount({ cfg, accountId });
}
