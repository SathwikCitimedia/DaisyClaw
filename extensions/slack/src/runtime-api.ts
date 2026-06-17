// Slack API module exposes the plugin public contract.
export {
  buildComputedAccountStatusSnapshot,
  PAIRING_APPROVED_MESSAGE,
  projectCredentialSnapshotFields,
  resolveConfiguredFromRequiredCredentialStatuses,
} from "daisyclaw/plugin-sdk/channel-status";
export { buildChannelConfigSchema, SlackConfigSchema } from "../config-api.js";
export type { ChannelMessageActionContext } from "daisyclaw/plugin-sdk/channel-contract";
export { DEFAULT_ACCOUNT_ID } from "daisyclaw/plugin-sdk/account-id";
export type {
  ChannelPlugin,
  DaisyClawPluginApi,
  PluginRuntime,
} from "daisyclaw/plugin-sdk/channel-plugin-common";
export type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
export type { SlackAccountConfig } from "daisyclaw/plugin-sdk/config-contracts";
export {
  emptyPluginConfigSchema,
  formatPairingApproveHint,
} from "daisyclaw/plugin-sdk/channel-plugin-common";
export { loadOutboundMediaFromUrl } from "daisyclaw/plugin-sdk/outbound-media";
export { looksLikeSlackTargetId, normalizeSlackMessagingTarget } from "./target-parsing.js";
export { getChatChannelMeta } from "./channel-api.js";
export {
  createActionGate,
  imageResultFromFile,
  jsonResult,
  readNumberParam,
  readPositiveIntegerParam,
  readReactionParams,
  readStringParam,
  withNormalizedTimestamp,
} from "daisyclaw/plugin-sdk/channel-actions";
