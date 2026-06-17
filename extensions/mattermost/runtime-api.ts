// Private runtime barrel for the bundled Mattermost extension.
// Keep this barrel thin and generic-only.

export type {
  BaseProbeResult,
  ChannelAccountSnapshot,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelPlugin,
  ChatType,
  HistoryEntry,
  DaisyClawConfig,
  DaisyClawPluginApi,
  PluginRuntime,
} from "daisyclaw/plugin-sdk/core";
export type { RuntimeEnv } from "daisyclaw/plugin-sdk/runtime";
export type { ReplyPayload } from "daisyclaw/plugin-sdk/reply-runtime";
export type { ModelsProviderData } from "daisyclaw/plugin-sdk/models-provider-runtime";
export type {
  BlockStreamingCoalesceConfig,
  DmPolicy,
  GroupPolicy,
} from "daisyclaw/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createDedupeCache,
  parseStrictPositiveInteger,
  resolveClientIp,
  isTrustedProxyAddress,
} from "daisyclaw/plugin-sdk/core";
export { buildComputedAccountStatusSnapshot } from "daisyclaw/plugin-sdk/channel-status";
export { createAccountStatusSink } from "daisyclaw/plugin-sdk/channel-outbound";
export { buildAgentMediaPayload } from "daisyclaw/plugin-sdk/agent-media-payload";
export {
  listSkillCommandsForAgents,
  resolveControlCommandGate,
  resolveStoredModelOverride,
} from "daisyclaw/plugin-sdk/command-auth-native";
export { buildModelsProviderData } from "daisyclaw/plugin-sdk/models-provider-runtime";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "daisyclaw/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "daisyclaw/plugin-sdk/dangerous-name-runtime";
export { loadSessionStore, resolveStorePath } from "daisyclaw/plugin-sdk/session-store-runtime";
export { formatInboundFromLabel } from "daisyclaw/plugin-sdk/channel-inbound";
export { logInboundDrop } from "daisyclaw/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "daisyclaw/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "daisyclaw/plugin-sdk/channel-outbound";
export { logTypingFailure } from "daisyclaw/plugin-sdk/channel-feedback";
export { loadOutboundMediaFromUrl } from "daisyclaw/plugin-sdk/outbound-media";
export { rawDataToString } from "daisyclaw/plugin-sdk/webhook-ingress";
export { chunkTextForOutbound } from "daisyclaw/plugin-sdk/text-chunking";
// Legacy map-helper exports stay for older plugin consumers. New message-turn
// code should use createChannelHistoryWindow.
export {
  DEFAULT_GROUP_HISTORY_LIMIT,
  createChannelHistoryWindow,
  buildPendingHistoryContextFromMap,
  clearHistoryEntriesIfEnabled,
  recordPendingHistoryEntryIfEnabled,
} from "daisyclaw/plugin-sdk/reply-history";
export { normalizeAccountId, resolveThreadSessionKeys } from "daisyclaw/plugin-sdk/routing";
export { resolveAllowlistMatchSimple } from "daisyclaw/plugin-sdk/allow-from";
export { registerPluginHttpRoute } from "daisyclaw/plugin-sdk/webhook-targets";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
} from "daisyclaw/plugin-sdk/webhook-ingress";
export {
  applyAccountNameToChannelSection,
  applySetupAccountConfigPatch,
  migrateBaseNameToDefaultAccount,
} from "daisyclaw/plugin-sdk/setup";
export {
  getAgentScopedMediaLocalRoots,
  resolveChannelMediaMaxBytes,
} from "daisyclaw/plugin-sdk/media-runtime";
export { normalizeProviderId } from "daisyclaw/plugin-sdk/provider-model-shared";
export { setMattermostRuntime } from "./src/runtime.js";
