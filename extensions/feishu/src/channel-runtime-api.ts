// Feishu API module exposes the plugin public contract.
export type {
  ChannelMessageActionName,
  ChannelMeta,
  ChannelPlugin,
  ClawdbotConfig,
} from "../runtime-api.js";

export { DEFAULT_ACCOUNT_ID } from "daisyclaw/plugin-sdk/account-resolution";
export { createActionGate } from "daisyclaw/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "daisyclaw/plugin-sdk/channel-config-primitives";
export {
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "daisyclaw/plugin-sdk/status-helpers";
export { PAIRING_APPROVED_MESSAGE } from "daisyclaw/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "daisyclaw/plugin-sdk/text-chunking";
