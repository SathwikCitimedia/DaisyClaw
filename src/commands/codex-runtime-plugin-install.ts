// Codex runtime plugin auto-install/repair helpers for OpenAI model selections.
import { modelSelectionShouldEnsureCodexPlugin } from "../agents/openai-routing.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import {
  createRuntimePluginModelSelectionHelpers,
  type RuntimePluginInstallResult,
} from "./runtime-plugin-install.js";

export const CODEX_RUNTIME_PLUGIN_ID = "codex";
const CODEX_RUNTIME_PLUGIN_LABEL = "Codex";
const CODEX_RUNTIME_PLUGIN_NPM_SPEC = "@daisyclaw/codex";
const CODEX_RUNTIME_PLUGIN_DESCRIPTOR = {
  pluginId: CODEX_RUNTIME_PLUGIN_ID,
  label: CODEX_RUNTIME_PLUGIN_LABEL,
  npmSpec: CODEX_RUNTIME_PLUGIN_NPM_SPEC,
  warningLabel: CODEX_RUNTIME_PLUGIN_LABEL,
};

export type CodexRuntimePluginInstallResult = RuntimePluginInstallResult;

/** Return true when a selected model requires the Codex runtime plugin to be installed. */
export function selectedModelShouldEnsureCodexRuntimePlugin(params: {
  cfg: DaisyClawConfig;
  model?: string;
}): boolean {
  return modelSelectionShouldEnsureCodexPlugin({
    config: params.cfg,
    model: params.model,
  });
}

const codexRuntimePluginInstall = createRuntimePluginModelSelectionHelpers({
  descriptor: CODEX_RUNTIME_PLUGIN_DESCRIPTOR,
  shouldEnsure: selectedModelShouldEnsureCodexRuntimePlugin,
});

export const ensureCodexRuntimePluginForModelSelection = codexRuntimePluginInstall.ensure;
export const repairCodexRuntimePluginInstallForModelSelection = codexRuntimePluginInstall.repair;
