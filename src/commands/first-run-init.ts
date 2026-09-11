/**
 * First-run initialization.
 *
 * When no config file exists (a fresh install), create a minimal usable one
 * instead of refusing to start: gateway.mode=local, a generated auth token so
 * the Control UI can actually connect, and the curated default skill pack so
 * non-technical users see the consumer tier instead of the full dev catalog.
 *
 * Deliberately does nothing when a config file exists — even an invalid one.
 * Invalid configs stay fail-closed (see config recovery); this path is only
 * for the "nothing there yet" case, matching `daisyclaw setup` semantics.
 */
import fs from "node:fs";
import type { DaisyClawConfig } from "../config/types.js";
import { applyDefaultSkillPack } from "../skills/default-skill-pack.js";
import { randomToken } from "./random-token.js";

export type FirstRunInitResult = {
  configPath: string;
  generatedToken: boolean;
  hiddenSkillCount: number;
};

/**
 * Adds the first-run defaults this initializer owns to a config object:
 * local gateway mode, a generated token when no auth is configured at all,
 * and the default skill pack. Pure; never removes or overwrites existing
 * values.
 */
/** True when the config declares any gateway auth intent (mode, token, or password). */
export function hasConfiguredGatewayAuth(cfg: DaisyClawConfig): boolean {
  return Boolean(
    cfg.gateway?.auth &&
    (cfg.gateway.auth.mode !== undefined ||
      cfg.gateway.auth.token !== undefined ||
      cfg.gateway.auth.password !== undefined),
  );
}

export function buildFirstRunConfig(
  cfg: DaisyClawConfig,
  options: { applySkillPack?: boolean } = {},
): {
  config: DaisyClawConfig;
  generatedToken: boolean;
  hiddenSkillCount: number;
} {
  const hasAnyAuth = hasConfiguredGatewayAuth(cfg);
  const withGateway: DaisyClawConfig = {
    ...cfg,
    gateway: {
      ...cfg.gateway,
      mode: cfg.gateway?.mode ?? "local",
      ...(hasAnyAuth ? {} : { auth: { ...cfg.gateway?.auth, token: randomToken() } }),
    },
  };
  const applySkillPack = options.applySkillPack ?? true;
  if (!applySkillPack) {
    return { config: withGateway, generatedToken: !hasAnyAuth, hiddenSkillCount: 0 };
  }
  const { config, hidden } = applyDefaultSkillPack(withGateway);
  return { config, generatedToken: !hasAnyAuth, hiddenSkillCount: hidden.length };
}

/**
 * Creates the initial config file for a fresh install. Returns null when a
 * config file already exists (nothing to do). Writes through the standard
 * config write path (validation, locking, audit trail).
 */
export async function initializeFreshConfigForFirstRun(): Promise<FirstRunInitResult | null> {
  const { createConfigIO, replaceConfigFile } = await import("../config/config.js");
  const io = createConfigIO();
  if (fs.existsSync(io.configPath)) {
    return null;
  }
  const { config, generatedToken, hiddenSkillCount } = buildFirstRunConfig({});
  await replaceConfigFile({
    nextConfig: config,
    afterWrite: { mode: "auto" },
  });
  return { configPath: io.configPath, generatedToken, hiddenSkillCount };
}
