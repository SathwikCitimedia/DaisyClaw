// Deepseek setup module handles plugin onboarding behavior.
import {
  applyAgentDefaultModelPrimary,
  applyProviderConfigWithModelCatalog,
  type DaisyClawConfig,
} from "daisyclaw/plugin-sdk/provider-onboard";
import { buildDeepSeekModelDefinition, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL_CATALOG } from "./api.js";

export const DEEPSEEK_DEFAULT_MODEL_REF = "deepseek/deepseek-v4-flash";

function applyDeepSeekProviderConfig(cfg: DaisyClawConfig): DaisyClawConfig {
  const models = { ...cfg.agents?.defaults?.models };
  models[DEEPSEEK_DEFAULT_MODEL_REF] = {
    ...models[DEEPSEEK_DEFAULT_MODEL_REF],
    alias: models[DEEPSEEK_DEFAULT_MODEL_REF]?.alias ?? "DeepSeek",
  };

  return applyProviderConfigWithModelCatalog(cfg, {
    agentModels: models,
    providerId: "deepseek",
    api: "openai-completions",
    baseUrl: DEEPSEEK_BASE_URL,
    catalogModels: DEEPSEEK_MODEL_CATALOG.map(buildDeepSeekModelDefinition),
  });
}

export function applyDeepSeekConfig(cfg: DaisyClawConfig): DaisyClawConfig {
  return applyAgentDefaultModelPrimary(
    applyDeepSeekProviderConfig(cfg),
    DEEPSEEK_DEFAULT_MODEL_REF,
  );
}
