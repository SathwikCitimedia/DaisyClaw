// Discord helper module supports runtime config behavior.
import {
  getRuntimeConfigSnapshot,
  getRuntimeConfigSourceSnapshot,
  selectApplicableRuntimeConfig,
} from "daisyclaw/plugin-sdk/runtime-config-snapshot";
import type { DaisyClawConfig } from "./runtime-api.js";

export function selectDiscordRuntimeConfig(inputConfig: DaisyClawConfig): DaisyClawConfig {
  return (
    selectApplicableRuntimeConfig({
      inputConfig,
      runtimeConfig: getRuntimeConfigSnapshot(),
      runtimeSourceConfig: getRuntimeConfigSourceSnapshot(),
    }) ?? inputConfig
  );
}
