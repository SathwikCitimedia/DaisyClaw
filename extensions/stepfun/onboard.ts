// Stepfun setup module handles plugin onboarding behavior.
import {
  createModelCatalogPresetAppliers,
  type ModelProviderConfig,
  type DaisyClawConfig,
  type ProviderOnboardPresetAppliers,
} from "daisyclaw/plugin-sdk/provider-onboard";
import {
  buildStepFunPlanProvider,
  buildStepFunProvider,
  STEPFUN_DEFAULT_MODEL_REF,
  STEPFUN_PLAN_CN_BASE_URL,
  STEPFUN_PLAN_DEFAULT_MODEL_REF,
  STEPFUN_PLAN_INTL_BASE_URL,
  STEPFUN_PLAN_PROVIDER_ID,
  STEPFUN_PROVIDER_ID,
  STEPFUN_STANDARD_CN_BASE_URL,
  STEPFUN_STANDARD_INTL_BASE_URL,
} from "./provider-catalog.js";

function createStepFunPresetAppliers(params: {
  providerId: string;
  primaryModelRef: string;
  alias: string;
  buildProvider: (baseUrl: string) => ModelProviderConfig;
}): ProviderOnboardPresetAppliers<[string]> {
  return createModelCatalogPresetAppliers<[string]>({
    primaryModelRef: params.primaryModelRef,
    resolveParams: (_cfg: DaisyClawConfig, baseUrl: string) => {
      const provider = params.buildProvider(baseUrl);
      const models = provider.models ?? [];
      return {
        providerId: params.providerId,
        api: provider.api ?? "openai-completions",
        baseUrl,
        catalogModels: models,
        aliases: [
          ...models.map((model) => `${params.providerId}/${model.id}`),
          { modelRef: params.primaryModelRef, alias: params.alias },
        ],
      };
    },
  });
}

const stepFunPresetAppliers = createStepFunPresetAppliers({
  providerId: STEPFUN_PROVIDER_ID,
  primaryModelRef: STEPFUN_DEFAULT_MODEL_REF,
  alias: "StepFun",
  buildProvider: buildStepFunProvider,
});

const stepFunPlanPresetAppliers = createStepFunPresetAppliers({
  providerId: STEPFUN_PLAN_PROVIDER_ID,
  primaryModelRef: STEPFUN_PLAN_DEFAULT_MODEL_REF,
  alias: "StepFun Plan",
  buildProvider: buildStepFunPlanProvider,
});

export function applyStepFunStandardConfigCn(cfg: DaisyClawConfig): DaisyClawConfig {
  return stepFunPresetAppliers.applyConfig(cfg, STEPFUN_STANDARD_CN_BASE_URL);
}

export function applyStepFunStandardConfig(cfg: DaisyClawConfig): DaisyClawConfig {
  return stepFunPresetAppliers.applyConfig(cfg, STEPFUN_STANDARD_INTL_BASE_URL);
}

export function applyStepFunPlanConfigCn(cfg: DaisyClawConfig): DaisyClawConfig {
  return stepFunPlanPresetAppliers.applyConfig(cfg, STEPFUN_PLAN_CN_BASE_URL);
}

export function applyStepFunPlanConfig(cfg: DaisyClawConfig): DaisyClawConfig {
  return stepFunPlanPresetAppliers.applyConfig(cfg, STEPFUN_PLAN_INTL_BASE_URL);
}
