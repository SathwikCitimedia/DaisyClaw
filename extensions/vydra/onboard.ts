// Vydra setup module handles plugin onboarding behavior.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/provider-onboard";

export const VYDRA_DEFAULT_IMAGE_MODEL_REF = "vydra/grok-imagine";

export function applyVydraConfig(cfg: DaisyClawConfig): DaisyClawConfig {
  if (cfg.agents?.defaults?.imageGenerationModel) {
    return cfg;
  }
  return {
    ...cfg,
    agents: {
      ...cfg.agents,
      defaults: {
        ...cfg.agents?.defaults,
        imageGenerationModel: {
          primary: VYDRA_DEFAULT_IMAGE_MODEL_REF,
        },
      },
    },
  };
}
