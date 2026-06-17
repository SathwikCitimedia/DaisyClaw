// Whatsapp plugin module implements account types behavior.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";

export type WhatsAppAccountConfig = NonNullable<
  NonNullable<NonNullable<DaisyClawConfig["channels"]>["whatsapp"]>["accounts"]
>[string];
