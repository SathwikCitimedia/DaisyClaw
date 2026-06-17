// Private runtime barrel for the bundled Twitch extension.
// Keep this barrel thin and aligned with the local extension surface.

export type {
  ChannelAccountSnapshot,
  ChannelCapabilities,
  ChannelGatewayContext,
  ChannelLogSink,
  ChannelMessageActionAdapter,
  ChannelMessageActionContext,
  ChannelMeta,
  ChannelOutboundAdapter,
  ChannelOutboundContext,
  ChannelResolveKind,
  ChannelResolveResult,
  ChannelStatusAdapter,
} from "daisyclaw/plugin-sdk/channel-contract";
export type { ChannelPlugin } from "daisyclaw/plugin-sdk/channel-core";
export type { OutboundDeliveryResult } from "daisyclaw/plugin-sdk/channel-send-result";
export type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
export type { RuntimeEnv } from "daisyclaw/plugin-sdk/runtime";
export type { WizardPrompter } from "daisyclaw/plugin-sdk/setup";
