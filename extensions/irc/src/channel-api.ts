// Irc API module exposes the plugin public contract.
export { createAccountStatusSink } from "daisyclaw/plugin-sdk/channel-outbound";
export { DEFAULT_ACCOUNT_ID } from "daisyclaw/plugin-sdk/account-id";
export type { ChannelPlugin } from "daisyclaw/plugin-sdk/channel-core";
export { PAIRING_APPROVED_MESSAGE } from "daisyclaw/plugin-sdk/channel-status";
export { buildBaseChannelStatusSummary } from "daisyclaw/plugin-sdk/status-helpers";
export { chunkTextForOutbound } from "daisyclaw/plugin-sdk/text-chunking";
