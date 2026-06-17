// Private runtime barrel for the bundled Feishu extension.
// Keep this barrel thin and generic-only.

export type {
  AllowlistMatch,
  AnyAgentTool,
  BaseProbeResult,
  ChannelGroupContext,
  ChannelMessageActionName,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelPlugin,
  HistoryEntry,
  DaisyClawConfig,
  DaisyClawPluginApi,
  OutboundIdentity,
  PluginRuntime,
  ReplyPayload,
} from "daisyclaw/plugin-sdk/core";
export type { DaisyClawConfig as ClawdbotConfig } from "daisyclaw/plugin-sdk/core";
export type RuntimeEnv = {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => void;
};
export type { GroupToolPolicyConfig } from "daisyclaw/plugin-sdk/config-contracts";
export {
  DEFAULT_ACCOUNT_ID,
  buildChannelConfigSchema,
  createActionGate,
  createDedupeCache,
} from "daisyclaw/plugin-sdk/core";
export {
  PAIRING_APPROVED_MESSAGE,
  buildProbeChannelStatusSummary,
  createDefaultChannelRuntimeState,
} from "daisyclaw/plugin-sdk/channel-status";
export { buildAgentMediaPayload } from "daisyclaw/plugin-sdk/agent-media-payload";
export { createChannelPairingController } from "daisyclaw/plugin-sdk/channel-pairing";
export { createReplyPrefixContext } from "daisyclaw/plugin-sdk/channel-outbound";
export {
  evaluateSupplementalContextVisibility,
  filterSupplementalContextItems,
  resolveChannelContextVisibilityMode,
} from "daisyclaw/plugin-sdk/context-visibility-runtime";
export {
  loadSessionStore,
  resolveSessionStoreEntry,
} from "daisyclaw/plugin-sdk/session-store-runtime";
export { readJsonFileWithFallback } from "daisyclaw/plugin-sdk/json-store";
export { normalizeAgentId } from "daisyclaw/plugin-sdk/routing";
export { chunkTextForOutbound } from "daisyclaw/plugin-sdk/text-chunking";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "daisyclaw/plugin-sdk/webhook-ingress";
export { setFeishuRuntime } from "./src/runtime.js";
