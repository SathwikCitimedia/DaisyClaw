// Mattermost API module exposes the plugin public contract.
export { createAccountStatusSink } from "daisyclaw/plugin-sdk/channel-outbound";
export type { ChannelPlugin } from "daisyclaw/plugin-sdk/core";
export { DEFAULT_ACCOUNT_ID } from "daisyclaw/plugin-sdk/core";
export { chunkTextForOutbound } from "daisyclaw/plugin-sdk/text-chunking";
