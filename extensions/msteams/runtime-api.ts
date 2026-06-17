// Private runtime barrel for the bundled Microsoft Teams extension.
// Keep this barrel thin and aligned with the local extension surface.

export { DEFAULT_ACCOUNT_ID } from "daisyclaw/plugin-sdk/account-id";
export type { AllowlistMatch } from "daisyclaw/plugin-sdk/allow-from";
export {
  mergeAllowlist,
  resolveAllowlistMatchSimple,
  summarizeMapping,
} from "daisyclaw/plugin-sdk/allow-from";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelOutboundAdapter,
} from "daisyclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "daisyclaw/plugin-sdk/channel-core";
export { logTypingFailure } from "daisyclaw/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "daisyclaw/plugin-sdk/channel-pairing";
export { resolveToolsBySender } from "daisyclaw/plugin-sdk/channel-policy";
export { createChannelMessageReplyPipeline } from "daisyclaw/plugin-sdk/channel-outbound";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "daisyclaw/plugin-sdk/channel-status";
export {
  buildChannelKeyCandidates,
  normalizeChannelSlug,
  resolveChannelEntryMatchWithFallback,
  resolveNestedAllowlistDecision,
} from "daisyclaw/plugin-sdk/channel-targets";
export type {
  GroupPolicy,
  GroupToolPolicyConfig,
  MSTeamsChannelConfig,
  MSTeamsCloudName,
  MSTeamsConfig,
  MSTeamsReplyStyle,
  MSTeamsTeamConfig,
  MarkdownTableMode,
  DaisyClawConfig,
} from "daisyclaw/plugin-sdk/config-contracts";
export { isDangerousNameMatchingEnabled } from "daisyclaw/plugin-sdk/dangerous-name-runtime";
export { resolveDefaultGroupPolicy } from "daisyclaw/plugin-sdk/runtime-group-policy";
export { withFileLock } from "daisyclaw/plugin-sdk/file-lock";
export { keepHttpServerTaskAlive } from "daisyclaw/plugin-sdk/channel-outbound";
export {
  detectMime,
  extensionForMime,
  extractOriginalFilename,
  getFileExtension,
  resolveChannelMediaMaxBytes,
} from "daisyclaw/plugin-sdk/media-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "daisyclaw/plugin-sdk/channel-inbound";
export { loadOutboundMediaFromUrl } from "daisyclaw/plugin-sdk/outbound-media";
export { buildMediaPayload } from "daisyclaw/plugin-sdk/reply-payload";
export type { ReplyPayload } from "daisyclaw/plugin-sdk/reply-payload";
export type { PluginRuntime } from "daisyclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "daisyclaw/plugin-sdk/runtime";
export type { SsrFPolicy } from "daisyclaw/plugin-sdk/ssrf-runtime";
export { fetchWithSsrFGuard } from "daisyclaw/plugin-sdk/ssrf-runtime";
export { normalizeStringEntries } from "daisyclaw/plugin-sdk/string-normalization-runtime";
export { chunkTextForOutbound } from "daisyclaw/plugin-sdk/text-chunking";
export { DEFAULT_WEBHOOK_MAX_BODY_BYTES } from "daisyclaw/plugin-sdk/webhook-ingress";
export { setMSTeamsRuntime } from "./src/runtime.js";
