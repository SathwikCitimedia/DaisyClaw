// Zai setup module handles plugin onboarding behavior.
import {
  applyProviderConfigWithModelCatalogPreset,
  type DaisyClawConfig,
} from "daisyclaw/plugin-sdk/provider-onboard";
import { normalizeOptionalString } from "daisyclaw/plugin-sdk/string-coerce-runtime";
import {
  buildZaiCatalogModels,
  resolveZaiBaseUrl,
  ZAI_DEFAULT_MODEL_ID,
} from "./model-definitions.js";

export const ZAI_DEFAULT_MODEL_REF = `zai/${ZAI_DEFAULT_MODEL_ID}`;

function resolveZaiPresetBaseUrl(cfg: DaisyClawConfig, endpoint?: string): string {
  const existingProvider = cfg.models?.providers?.zai;
  const existingBaseUrl = normalizeOptionalString(existingProvider?.baseUrl) ?? "";
  return endpoint ? resolveZaiBaseUrl(endpoint) : existingBaseUrl || resolveZaiBaseUrl();
}

function applyZaiPreset(
  cfg: DaisyClawConfig,
  params?: { endpoint?: string; modelId?: string },
  primaryModelRef?: string,
): DaisyClawConfig {
  const modelId = normalizeOptionalString(params?.modelId) ?? ZAI_DEFAULT_MODEL_ID;
  const modelRef = `zai/${modelId}`;
  return applyProviderConfigWithModelCatalogPreset(cfg, {
    providerId: "zai",
    api: "openai-completions",
    baseUrl: resolveZaiPresetBaseUrl(cfg, params?.endpoint),
    catalogModels: buildZaiCatalogModels(),
    aliases: [{ modelRef, alias: "GLM" }],
    primaryModelRef,
  });
}

export function applyZaiProviderConfig(
  cfg: DaisyClawConfig,
  params?: { endpoint?: string; modelId?: string },
): DaisyClawConfig {
  return applyZaiPreset(cfg, params);
}

export function applyZaiConfig(
  cfg: DaisyClawConfig,
  params?: { endpoint?: string; modelId?: string },
): DaisyClawConfig {
  const modelId = normalizeOptionalString(params?.modelId) ?? ZAI_DEFAULT_MODEL_ID;
  const modelRef = modelId === ZAI_DEFAULT_MODEL_ID ? ZAI_DEFAULT_MODEL_REF : `zai/${modelId}`;
  return applyZaiPreset(cfg, params, modelRef);
}
