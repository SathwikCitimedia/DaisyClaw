// Private runtime barrel for the bundled Nextcloud Talk extension.
// Keep this barrel thin and aligned with the local extension surface.

export type { AllowlistMatch } from "daisyclaw/plugin-sdk/allow-from";
export type { ChannelGroupContext } from "daisyclaw/plugin-sdk/channel-contract";
export { logInboundDrop } from "daisyclaw/plugin-sdk/channel-inbound";
export { createChannelPairingController } from "daisyclaw/plugin-sdk/channel-pairing";
export type {
  BlockStreamingCoalesceConfig,
  DmConfig,
  DmPolicy,
  GroupPolicy,
  GroupToolPolicyConfig,
  DaisyClawConfig,
} from "daisyclaw/plugin-sdk/config-contracts";
export {
  GROUP_POLICY_BLOCKED_LABEL,
  resolveAllowlistProviderRuntimeGroupPolicy,
  resolveDefaultGroupPolicy,
  warnMissingProviderGroupPolicyFallbackOnce,
} from "daisyclaw/plugin-sdk/runtime-group-policy";
export { createChannelMessageReplyPipeline } from "daisyclaw/plugin-sdk/channel-outbound";
export type { OutboundReplyPayload } from "daisyclaw/plugin-sdk/reply-payload";
export { deliverFormattedTextWithAttachments } from "daisyclaw/plugin-sdk/reply-payload";
export type { PluginRuntime } from "daisyclaw/plugin-sdk/runtime-store";
export type { RuntimeEnv } from "daisyclaw/plugin-sdk/runtime";
export type { SecretInput } from "daisyclaw/plugin-sdk/secret-input";
export { fetchWithSsrFGuard } from "daisyclaw/plugin-sdk/ssrf-runtime";
export { setNextcloudTalkRuntime } from "./src/runtime.js";
