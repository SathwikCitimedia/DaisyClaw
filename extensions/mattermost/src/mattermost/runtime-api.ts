// Mattermost API module exposes the plugin public contract.
export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChatType,
  HistoryEntry,
  DaisyClawConfig,
  DaisyClawPluginApi,
  ReplyPayload,
} from "daisyclaw/plugin-sdk/core";
export type { RuntimeEnv } from "daisyclaw/plugin-sdk/runtime";
export { buildAgentMediaPayload } from "daisyclaw/plugin-sdk/agent-media-payload";
export { resolveAllowlistMatchSimple } from "daisyclaw/plugin-sdk/allow-from";
export { logInboundDrop } from "daisyclaw/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "daisyclaw/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "daisyclaw/plugin-sdk/channel-outbound";
export { logTypingFailure } from "daisyclaw/plugin-sdk/channel-feedback";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
} from "daisyclaw/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "daisyclaw/plugin-sdk/models-provider-runtime";
export { isDangerousNameMatchingEnabled } from "daisyclaw/plugin-sdk/dangerous-name-runtime";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "daisyclaw/plugin-sdk/runtime-group-policy";
export { resolveChannelMediaMaxBytes } from "daisyclaw/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "daisyclaw/plugin-sdk/outbound-media";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildInboundHistoryFromMap,
  buildPendingHistoryContextFromMap,
  recordPendingHistoryEntryIfEnabled,
} from "daisyclaw/plugin-sdk/reply-history";
export { registerPluginHttpRoute } from "daisyclaw/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "daisyclaw/plugin-sdk/webhook-ingress";
export {
  isTrustedProxyAddress,
  parseStrictPositiveInteger,
  resolveClientIp,
} from "daisyclaw/plugin-sdk/core";
export { parseTcpPort } from "daisyclaw/plugin-sdk/number-runtime";
