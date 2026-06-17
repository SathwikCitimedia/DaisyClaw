// Qqbot API module exposes the plugin public contract.
export type { ChannelPlugin, DaisyClawPluginApi, PluginRuntime } from "daisyclaw/plugin-sdk/core";
export type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
export type {
  DaisyClawPluginService,
  DaisyClawPluginServiceContext,
  PluginLogger,
} from "daisyclaw/plugin-sdk/core";
export type { ResolvedQQBotAccount, QQBotAccountConfig } from "./src/types.js";
export { getQQBotRuntime, setQQBotRuntime } from "./src/bridge/runtime.js";
