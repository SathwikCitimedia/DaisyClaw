// Private runtime barrel for the bundled IRC extension.
// Keep this barrel thin and generic-only.

export type { BaseProbeResult } from "daisyclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "daisyclaw/plugin-sdk/channel-core";
export type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
export type { PluginRuntime } from "daisyclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "daisyclaw/plugin-sdk/runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyBySenderConfig,
  GroupToolPolicyConfig,
  MarkdownConfig,
} from "daisyclaw/plugin-sdk/config-contracts";
export type { OutboundReplyPayload } from "daisyclaw/plugin-sdk/reply-payload";
export { DEFAULT_ACCOUNT_ID } from "daisyclaw/plugin-sdk/account-id";
export { buildChannelConfigSchema } from "daisyclaw/plugin-sdk/channel-config-primitives";
export {
  PAIRING_APPROVED_MESSAGE,
  buildBaseChannelStatusSummary,
} from "daisyclaw/plugin-sdk/channel-status";
export { createChannelPairingController } from "daisyclaw/plugin-sdk/channel-pairing";
export { createAccountStatusSink } from "daisyclaw/plugin-sdk/channel-outbound";
export { resolveControlCommandGate } from "daisyclaw/plugin-sdk/command-auth-native";
export { createChannelMessageReplyPipeline } from "daisyclaw/plugin-sdk/channel-outbound";
export { chunkTextForOutbound } from "daisyclaw/plugin-sdk/text-chunking";
export {
  deliverFormattedTextWithAttachments,
  formatTextWithAttachmentLinks,
  resolveOutboundMediaUrls,
} from "daisyclaw/plugin-sdk/reply-payload";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "daisyclaw/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "daisyclaw/plugin-sdk/dangerous-name-runtime";
export { logInboundDrop } from "daisyclaw/plugin-sdk/channel-inbound";
