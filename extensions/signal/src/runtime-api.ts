// Private runtime barrel for the bundled Signal extension.
// Prefer narrower SDK subpaths plus local extension seams over the legacy signal barrel.

export type { ChannelMessageActionAdapter } from "daisyclaw/plugin-sdk/channel-contract";
export { buildChannelConfigSchema, SignalConfigSchema } from "../config-api.js";
export { PAIRING_APPROVED_MESSAGE } from "daisyclaw/plugin-sdk/channel-status";
import type { DaisyClawConfig as RuntimeDaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
export type { RuntimeDaisyClawConfig as DaisyClawConfig };
export type { DaisyClawPluginApi, PluginRuntime } from "daisyclaw/plugin-sdk/core";
export type { ChannelPlugin } from "daisyclaw/plugin-sdk/core";
export {
  DEFAULT_ACCOUNT_ID,
  applyAccountNameToChannelSection,
  deleteAccountFromConfigSection,
  emptyPluginConfigSchema,
  formatPairingApproveHint,
  getChatChannelMeta,
  migrateBaseNameToDefaultAccount,
  normalizeAccountId,
  setAccountEnabledInConfigSection,
} from "daisyclaw/plugin-sdk/core";
export { resolveChannelMediaMaxBytes } from "daisyclaw/plugin-sdk/media-runtime";
export { formatCliCommand, formatDocsLink } from "daisyclaw/plugin-sdk/setup-tools";
export { chunkText } from "daisyclaw/plugin-sdk/reply-runtime";
export { detectBinary } from "daisyclaw/plugin-sdk/setup-tools";
export {
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
} from "daisyclaw/plugin-sdk/runtime-group-policy";
export {
  buildBaseAccountStatusSnapshot,
  buildBaseChannelStatusSummary,
  collectStatusIssuesFromLastError,
  createDefaultChannelRuntimeState,
} from "daisyclaw/plugin-sdk/status-helpers";
export { normalizeE164 } from "daisyclaw/plugin-sdk/text-utility-runtime";
export { looksLikeSignalTargetId, normalizeSignalMessagingTarget } from "./normalize.js";
export {
  listEnabledSignalAccounts,
  listSignalAccountIds,
  resolveDefaultSignalAccountId,
  resolveSignalAccount,
} from "./accounts.js";
export { monitorSignalProvider } from "./monitor.js";
export { installSignalCli } from "./install-signal-cli.js";
export { probeSignal } from "./probe.js";
export { resolveSignalReactionLevel } from "./reaction-level.js";
export { removeReactionSignal, sendReactionSignal } from "./send-reactions.js";
export { sendMessageSignal } from "./send.js";
export { signalMessageActions } from "./message-actions.js";
export type { ResolvedSignalAccount } from "./accounts.js";
export type { SignalAccountConfig } from "./account-types.js";
