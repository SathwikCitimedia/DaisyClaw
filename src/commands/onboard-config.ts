/** Shared config mutations used by interactive and non-interactive onboarding. */
import { setConfigValueAtPath } from "../config/config-paths.js";
import type { DmScope } from "../config/types.base.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import type { ToolProfileId } from "../config/types.tools.js";

/** Default DM scoping selected during local onboarding. */
export const ONBOARDING_DEFAULT_DM_SCOPE: DmScope = "per-channel-peer";
/** Default tool profile selected during local onboarding. */
export const ONBOARDING_DEFAULT_TOOLS_PROFILE: ToolProfileId = "coding";

/** Applies local gateway/workspace defaults without overwriting explicit user defaults. */
export function applyLocalSetupWorkspaceConfig(
  baseConfig: DaisyClawConfig,
  workspaceDir: string,
): DaisyClawConfig {
  return {
    ...baseConfig,
    agents: {
      ...baseConfig.agents,
      defaults: {
        ...baseConfig.agents?.defaults,
        workspace: workspaceDir,
      },
    },
    gateway: {
      ...baseConfig.gateway,
      mode: "local",
    },
    session: {
      ...baseConfig.session,
      dmScope: baseConfig.session?.dmScope ?? ONBOARDING_DEFAULT_DM_SCOPE,
    },
    tools: {
      ...baseConfig.tools,
      profile: baseConfig.tools?.profile ?? ONBOARDING_DEFAULT_TOOLS_PROFILE,
    },
  };
}

/** Marks default agents to skip bootstrap file creation. */
export function applySkipBootstrapConfig(cfg: DaisyClawConfig): DaisyClawConfig {
  const next = structuredClone(cfg);
  setConfigValueAtPath(
    next as Record<string, unknown>,
    ["agents", "defaults", "skipBootstrap"],
    true,
  );
  return next;
}
