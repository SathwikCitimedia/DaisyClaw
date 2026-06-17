// Lobster API module exposes the plugin public contract.
export { definePluginEntry } from "daisyclaw/plugin-sdk/core";
export type {
  AnyAgentTool,
  DaisyClawPluginApi,
  DaisyClawPluginToolContext,
  DaisyClawPluginToolFactory,
} from "daisyclaw/plugin-sdk/core";
export {
  applyWindowsSpawnProgramPolicy,
  materializeWindowsSpawnProgram,
  resolveWindowsSpawnProgramCandidate,
} from "daisyclaw/plugin-sdk/windows-spawn";
