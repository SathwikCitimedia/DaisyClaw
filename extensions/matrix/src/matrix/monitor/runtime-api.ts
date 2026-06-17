// Narrow Matrix monitor helper seam.
// Keep monitor internals off the broad package runtime-api barrel so monitor
// tests and shared workers do not pull unrelated Matrix helper surfaces.

export type { NormalizedLocation } from "daisyclaw/plugin-sdk/channel-inbound";
export type { PluginRuntime, RuntimeLogger } from "daisyclaw/plugin-sdk/plugin-runtime";
export type { BlockReplyContext, ReplyPayload } from "daisyclaw/plugin-sdk/reply-runtime";
export type { MarkdownTableMode, DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "daisyclaw/plugin-sdk/runtime";
export {
  addAllowlistUserEntriesFromConfigEntry,
  buildAllowlistResolutionSummary,
  canonicalizeAllowlistWithResolvedIds,
  formatAllowlistMatchMeta,
  patchAllowlistUsersInConfigEntries,
  summarizeMapping,
} from "daisyclaw/plugin-sdk/allow-from";
export {
  createReplyPrefixOptions,
  createTypingCallbacks,
} from "daisyclaw/plugin-sdk/channel-outbound";
export { formatLocationText, toLocationContext } from "daisyclaw/plugin-sdk/channel-inbound";
export { getAgentScopedMediaLocalRoots } from "daisyclaw/plugin-sdk/agent-media-payload";
export { logInboundDrop } from "daisyclaw/plugin-sdk/channel-inbound";
export { logTypingFailure } from "daisyclaw/plugin-sdk/channel-outbound";
export {
  buildChannelKeyCandidates,
  resolveChannelEntryMatch,
} from "daisyclaw/plugin-sdk/channel-targets";
