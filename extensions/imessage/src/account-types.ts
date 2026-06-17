// Imessage plugin module implements account types behavior.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";

export type IMessageAccountConfig = Omit<
  NonNullable<NonNullable<DaisyClawConfig["channels"]>["imessage"]>,
  "accounts" | "defaultAccount"
>;
