// Tavily helper module supports tavily tool config behavior.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
import type { DaisyClawPluginToolContext } from "daisyclaw/plugin-sdk/plugin-entry";
import type { DaisyClawPluginApi } from "daisyclaw/plugin-sdk/plugin-runtime";

export type TavilyToolConfigContext = Pick<
  DaisyClawPluginToolContext,
  "config" | "runtimeConfig" | "getRuntimeConfig"
>;

export function resolveTavilyToolConfig(
  api: DaisyClawPluginApi,
  ctx?: TavilyToolConfigContext,
): DaisyClawConfig {
  return ctx?.getRuntimeConfig?.() ?? ctx?.runtimeConfig ?? ctx?.config ?? api.config;
}
