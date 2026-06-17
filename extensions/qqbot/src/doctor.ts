// Qqbot plugin module implements doctor behavior.
import type { ChannelDoctorAdapter } from "daisyclaw/plugin-sdk/channel-contract";
import { legacyConfigRules, normalizeCompatibilityConfig } from "./doctor-contract.js";

export const qqbotDoctor: ChannelDoctorAdapter = {
  legacyConfigRules,
  normalizeCompatibilityConfig,
};
