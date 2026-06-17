// Xiaomi setup module handles plugin onboarding behavior.
import {
  createDefaultModelsPresetAppliers,
  type DaisyClawConfig,
} from "daisyclaw/plugin-sdk/provider-onboard";
import {
  buildXiaomiProvider,
  buildXiaomiTokenPlanProvider,
  resolveXiaomiTokenPlanBaseUrl,
  XIAOMI_DEFAULT_MODEL_ID,
  XIAOMI_PROVIDER_ID,
  XIAOMI_TOKEN_PLAN_DEFAULT_MODEL_ID,
  XIAOMI_TOKEN_PLAN_PROVIDER_ID,
  type XiaomiTokenPlanRegion,
} from "./provider-catalog.js";

export const XIAOMI_DEFAULT_MODEL_REF = `${XIAOMI_PROVIDER_ID}/${XIAOMI_DEFAULT_MODEL_ID}`;
export const XIAOMI_TOKEN_PLAN_DEFAULT_MODEL_REF = `${XIAOMI_TOKEN_PLAN_PROVIDER_ID}/${XIAOMI_TOKEN_PLAN_DEFAULT_MODEL_ID}`;

const xiaomiPresetAppliers = createDefaultModelsPresetAppliers({
  primaryModelRef: XIAOMI_DEFAULT_MODEL_REF,
  resolveParams: (_cfg: DaisyClawConfig) => {
    const defaultProvider = buildXiaomiProvider();
    return {
      providerId: XIAOMI_PROVIDER_ID,
      api: defaultProvider.api ?? "openai-completions",
      baseUrl: defaultProvider.baseUrl,
      defaultModels: defaultProvider.models ?? [],
      defaultModelId: XIAOMI_DEFAULT_MODEL_ID,
      aliases: [{ modelRef: XIAOMI_DEFAULT_MODEL_REF, alias: "Xiaomi" }],
    };
  },
});

const xiaomiTokenPlanPresetAppliers = createDefaultModelsPresetAppliers({
  primaryModelRef: XIAOMI_TOKEN_PLAN_DEFAULT_MODEL_REF,
  resolveParams: (_cfg: DaisyClawConfig) => {
    const defaultProvider = buildXiaomiTokenPlanProvider();
    return {
      providerId: XIAOMI_TOKEN_PLAN_PROVIDER_ID,
      api: defaultProvider.api ?? "openai-completions",
      baseUrl: defaultProvider.baseUrl,
      defaultModels: defaultProvider.models ?? [],
      defaultModelId: XIAOMI_TOKEN_PLAN_DEFAULT_MODEL_ID,
      aliases: (() => {
        const defaultModel = defaultProvider.models?.find(
          (m) => m.id === XIAOMI_TOKEN_PLAN_DEFAULT_MODEL_ID,
        );
        return [
          {
            modelRef: XIAOMI_TOKEN_PLAN_DEFAULT_MODEL_REF,
            alias: defaultModel?.name ?? "MiMo V2.5 Pro",
          },
        ];
      })(),
    };
  },
});

function withProviderBaseUrl(
  cfg: DaisyClawConfig,
  providerId: string,
  baseUrl: string,
): DaisyClawConfig {
  const providers: Record<string, unknown> = {
    ...cfg.models?.providers,
    [providerId]: {
      ...cfg.models?.providers?.[providerId],
      baseUrl,
    },
  };
  return {
    ...cfg,
    models: {
      ...cfg.models,
      providers,
    },
  } as DaisyClawConfig;
}

export function applyXiaomiProviderConfig(cfg: DaisyClawConfig): DaisyClawConfig {
  return xiaomiPresetAppliers.applyProviderConfig(cfg);
}

export function applyXiaomiConfig(cfg: DaisyClawConfig): DaisyClawConfig {
  return xiaomiPresetAppliers.applyConfig(cfg);
}

export function applyXiaomiTokenPlanProviderConfig(
  cfg: DaisyClawConfig,
  region: XiaomiTokenPlanRegion,
): DaisyClawConfig {
  return withProviderBaseUrl(
    xiaomiTokenPlanPresetAppliers.applyProviderConfig(cfg),
    XIAOMI_TOKEN_PLAN_PROVIDER_ID,
    resolveXiaomiTokenPlanBaseUrl(region),
  );
}

export function applyXiaomiTokenPlanConfig(
  cfg: DaisyClawConfig,
  region: XiaomiTokenPlanRegion,
): DaisyClawConfig {
  return withProviderBaseUrl(
    xiaomiTokenPlanPresetAppliers.applyConfig(cfg),
    XIAOMI_TOKEN_PLAN_PROVIDER_ID,
    resolveXiaomiTokenPlanBaseUrl(region),
  );
}
