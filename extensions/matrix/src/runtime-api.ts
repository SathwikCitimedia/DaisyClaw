// Matrix API module exposes the plugin public contract.
export {
  DEFAULT_ACCOUNT_ID,
  normalizeAccountId,
  normalizeOptionalAccountId,
} from "daisyclaw/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readPositiveIntegerParam,
  readReactionParams,
  readStringArrayParam,
  readStringParam,
  ToolAuthorizationError,
} from "daisyclaw/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "daisyclaw/plugin-sdk/channel-config-primitives";
export type { ChannelPlugin } from "daisyclaw/plugin-sdk/channel-core";
export type {
  BaseProbeResult,
  ChannelDirectoryEntry,
  ChannelGroupContext,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMessageActionName,
  ChannelMessageToolDiscovery,
  ChannelOutboundAdapter,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelToolSend,
} from "daisyclaw/plugin-sdk/channel-contract";
export {
  formatLocationText,
  toLocationContext,
  type NormalizedLocation,
} from "daisyclaw/plugin-sdk/channel-inbound";
export { logInboundDrop } from "daisyclaw/plugin-sdk/channel-inbound";
export { logTypingFailure } from "daisyclaw/plugin-sdk/channel-outbound";
export { resolveAckReaction } from "daisyclaw/plugin-sdk/channel-feedback";
export type { ChannelSetupInput } from "daisyclaw/plugin-sdk/setup";
export type {
  DaisyClawConfig,
  ContextVisibilityMode,
  DmPolicy,
  GroupPolicy,
} from "daisyclaw/plugin-sdk/config-contracts";
export type { GroupToolPolicyConfig } from "daisyclaw/plugin-sdk/config-contracts";
export type { WizardPrompter } from "daisyclaw/plugin-sdk/setup";
export type { SecretInput } from "daisyclaw/plugin-sdk/secret-input";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "daisyclaw/plugin-sdk/runtime-group-policy";
export {
  addWildcardAllowFrom,
  formatDocsLink,
  hasConfiguredSecretInput,
  mergeAllowFromEntries,
  moveSingleAccountChannelSectionToDefaultAccount,
  promptAccountId,
  promptChannelAccessConfig,
  splitSetupEntries,
} from "daisyclaw/plugin-sdk/setup";
export type { RuntimeEnv } from "daisyclaw/plugin-sdk/runtime";
export {
  assertHttpUrlTargetsPrivateNetwork,
  closeDispatcher,
  createPinnedDispatcher,
  isPrivateOrLoopbackHost,
  resolvePinnedHostnameWithPolicy,
  ssrfPolicyFromDangerouslyAllowPrivateNetwork,
  ssrfPolicyFromAllowPrivateNetwork,
  type LookupFn,
  type SsrFPolicy,
} from "daisyclaw/plugin-sdk/ssrf-runtime";
export { dispatchReplyFromConfigWithSettledDispatcher } from "daisyclaw/plugin-sdk/channel-inbound";
export {
  ensureConfiguredAcpBindingReady,
  resolveConfiguredAcpBindingRecord,
} from "daisyclaw/plugin-sdk/acp-binding-runtime";
export {
  buildProbeChannelStatusSummary,
  collectStatusIssuesFromLastError,
  PAIRING_APPROVED_MESSAGE,
} from "daisyclaw/plugin-sdk/channel-status";
export {
  getSessionBindingService,
  resolveThreadBindingIdleTimeoutMsForChannel,
  resolveThreadBindingMaxAgeMsForChannel,
} from "daisyclaw/plugin-sdk/conversation-runtime";
export { resolveOutboundSendDep } from "daisyclaw/plugin-sdk/channel-outbound";
export { resolveAgentIdFromSessionKey } from "daisyclaw/plugin-sdk/routing";
export { chunkTextForOutbound } from "daisyclaw/plugin-sdk/text-chunking";
export { createChannelMessageReplyPipeline } from "daisyclaw/plugin-sdk/channel-outbound";
export { loadOutboundMediaFromUrl } from "daisyclaw/plugin-sdk/outbound-media";
export { normalizePollInput, type PollInput } from "daisyclaw/plugin-sdk/poll-runtime";
export { writeJsonFileAtomically } from "daisyclaw/plugin-sdk/json-store";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "daisyclaw/plugin-sdk/channel-targets";
export { buildTimeoutAbortSignal } from "./matrix/sdk/timeout-abort-signal.js";
export { formatZonedTimestamp } from "daisyclaw/plugin-sdk/time-runtime";
export type { PluginRuntime, RuntimeLogger } from "daisyclaw/plugin-sdk/plugin-runtime";
export type { ReplyPayload } from "daisyclaw/plugin-sdk/reply-runtime";
// resolveMatrixAccountStringValues already comes from the Matrix API barrel.
// Re-exporting auth-precedence here makes TS source loaders define the export twice.
