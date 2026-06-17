// Whatsapp plugin module implements doctor contract behavior.
import type { ChannelDoctorConfigMutation } from "daisyclaw/plugin-sdk/channel-contract";
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
import { normalizeCompatibilityConfig as normalizeCompatibilityConfigImpl } from "./doctor.js";

export function normalizeCompatibilityConfig({
  cfg,
}: {
  cfg: DaisyClawConfig;
}): ChannelDoctorConfigMutation {
  return normalizeCompatibilityConfigImpl({ cfg });
}
