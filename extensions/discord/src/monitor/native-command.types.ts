// Discord type declarations define plugin contracts.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
import type { CommandArgValues } from "daisyclaw/plugin-sdk/native-command-registry";

export type DiscordConfig = NonNullable<DaisyClawConfig["channels"]>["discord"];

export type DiscordCommandArgs = {
  raw?: string;
  values?: CommandArgValues;
};
