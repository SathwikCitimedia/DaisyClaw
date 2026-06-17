// Discord plugin module implements commands behavior.
import type { DiscordSlashCommandConfig } from "daisyclaw/plugin-sdk/config-contracts";

export function resolveDiscordSlashCommandConfig(
  raw?: DiscordSlashCommandConfig,
): Required<DiscordSlashCommandConfig> {
  return {
    ephemeral: raw?.ephemeral !== false,
  };
}
