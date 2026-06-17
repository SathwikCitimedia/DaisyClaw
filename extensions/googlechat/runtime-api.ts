// Private runtime barrel for the bundled Google Chat extension.
// Keep this barrel thin and avoid broad plugin-sdk surfaces during bootstrap.

export { DEFAULT_ACCOUNT_ID } from "daisyclaw/plugin-sdk/account-id";
export {
  createActionGate,
  jsonResult,
  readNumberParam,
  readReactionParams,
  readStringParam,
} from "daisyclaw/plugin-sdk/channel-actions";
export { buildChannelConfigSchema } from "daisyclaw/plugin-sdk/channel-config-primitives";
export type {
  ChannelMessageActionAdapter,
  ChannelMessageActionName,
  ChannelStatusIssue,
} from "daisyclaw/plugin-sdk/channel-contract";
export { missingTargetError } from "daisyclaw/plugin-sdk/channel-feedback";
export {
  createAccountStatusSink,
  runPassiveAccountLifecycle,
} from "daisyclaw/plugin-sdk/channel-outbound";
export { createChannelPairingController } from "daisyclaw/plugin-sdk/channel-pairing";
export { createChannelMessageReplyPipeline } from "daisyclaw/plugin-sdk/channel-outbound";
export { PAIRING_APPROVED_MESSAGE } from "daisyclaw/plugin-sdk/channel-status";
export { chunkTextForOutbound } from "daisyclaw/plugin-sdk/text-chunking";
export type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
export { GoogleChatConfigSchema } from "daisyclaw/plugin-sdk/bundled-channel-config-schema";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "daisyclaw/plugin-sdk/runtime-group-policy";
export { isDangerousNameMatchingEnabled } from "daisyclaw/plugin-sdk/dangerous-name-runtime";
export {
  readRemoteMediaBuffer,
  resolveChannelMediaMaxBytes,
} from "daisyclaw/plugin-sdk/media-runtime";
export { loadOutboundMediaFromUrl } from "daisyclaw/plugin-sdk/outbound-media";
export type { PluginRuntime } from "daisyclaw/plugin-sdk/runtime-store";
export { fetchWithSsrFGuard } from "daisyclaw/plugin-sdk/ssrf-runtime";
export type {
  GoogleChatAccountConfig,
  GoogleChatConfig,
} from "daisyclaw/plugin-sdk/config-contracts";
export { extractToolSend } from "daisyclaw/plugin-sdk/tool-send";
export { resolveInboundMentionDecision } from "daisyclaw/plugin-sdk/channel-inbound";
export { resolveInboundRouteEnvelopeBuilderWithRuntime } from "daisyclaw/plugin-sdk/inbound-envelope";
export { resolveWebhookPath } from "daisyclaw/plugin-sdk/webhook-ingress";
export {
  registerWebhookTargetWithPluginRoute,
  resolveWebhookTargetWithAuthOrReject,
  withResolvedWebhookRequestPipeline,
} from "daisyclaw/plugin-sdk/webhook-targets";
export {
  createWebhookInFlightLimiter,
  readJsonWebhookBodyOrReject,
  type WebhookInFlightLimiter,
} from "daisyclaw/plugin-sdk/webhook-request-guards";
export { setGoogleChatRuntime } from "./src/runtime.js";
