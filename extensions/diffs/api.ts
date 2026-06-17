// Diffs API module exposes the plugin public contract.
export type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
export {
  definePluginEntry,
  type AnyAgentTool,
  type DaisyClawPluginApi,
  type DaisyClawPluginConfigSchema,
  type DaisyClawPluginToolContext,
  type PluginLogger,
} from "daisyclaw/plugin-sdk/plugin-entry";
export { resolvePreferredDaisyClawTmpDir } from "daisyclaw/plugin-sdk/temp-path";
