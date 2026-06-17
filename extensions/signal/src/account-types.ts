// Signal plugin module implements account types behavior.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";

export type SignalAccountConfig = Omit<
  Exclude<NonNullable<DaisyClawConfig["channels"]>["signal"], undefined>,
  "accounts"
>;
