// Config path helpers resolve plugin-visible state and config file locations from DaisyClaw config.
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";

/** Resolve the config path prefix for a channel account, falling back to the root channel section. */
export function resolveChannelAccountConfigBasePath(params: {
  cfg: DaisyClawConfig;
  channelKey: string;
  accountId: string;
}): string {
  const channels = params.cfg.channels as unknown as Record<string, unknown> | undefined;
  const channelSection = channels?.[params.channelKey] as Record<string, unknown> | undefined;
  const accounts = channelSection?.accounts as Record<string, unknown> | undefined;
  const useAccountPath = Boolean(accounts?.[params.accountId]);
  return useAccountPath
    ? `channels.${params.channelKey}.accounts.${params.accountId}.`
    : `channels.${params.channelKey}.`;
}
