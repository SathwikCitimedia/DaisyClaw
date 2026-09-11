// First-run init tests cover fresh-install config generation.
import { describe, expect, it } from "vitest";
import type { DaisyClawConfig } from "../config/types.js";
import { buildFirstRunConfig, hasConfiguredGatewayAuth } from "./first-run-init.js";

describe("hasConfiguredGatewayAuth", () => {
  it("is false for empty config", () => {
    expect(hasConfiguredGatewayAuth({})).toBe(false);
  });

  it("is true when any auth intent exists", () => {
    expect(hasConfiguredGatewayAuth({ gateway: { auth: { token: "t" } } })).toBe(true);
    expect(hasConfiguredGatewayAuth({ gateway: { auth: { password: "p" } } })).toBe(true);
    expect(hasConfiguredGatewayAuth({ gateway: { auth: { mode: "none" } } })).toBe(true);
  });
});

describe("buildFirstRunConfig", () => {
  it("creates a connectable local config from nothing", () => {
    const { config, generatedToken, hiddenSkillCount } = buildFirstRunConfig({});
    expect(config.gateway?.mode).toBe("local");
    expect(typeof config.gateway?.auth?.token).toBe("string");
    expect(String(config.gateway?.auth?.token).length).toBeGreaterThan(0);
    expect(generatedToken).toBe(true);
    expect(hiddenSkillCount).toBeGreaterThan(0);
    const hidden = Object.values(config.skills?.entries ?? {}).filter(
      (entry) => entry?.enabled === false,
    );
    expect(hidden.length).toBe(hiddenSkillCount);
  });

  it("never overwrites existing auth or mode", () => {
    const cfg: DaisyClawConfig = {
      gateway: { mode: "local", auth: { token: "user-token" } },
    };
    const { config, generatedToken } = buildFirstRunConfig(cfg);
    expect(config.gateway?.auth?.token).toBe("user-token");
    expect(generatedToken).toBe(false);
  });

  it("respects an explicit auth mode of none", () => {
    const cfg: DaisyClawConfig = { gateway: { auth: { mode: "none" } } };
    const { config, generatedToken } = buildFirstRunConfig(cfg);
    expect(config.gateway?.auth?.mode).toBe("none");
    expect(config.gateway?.auth?.token).toBeUndefined();
    expect(generatedToken).toBe(false);
  });

  it("skips the skill pack when asked", () => {
    const { config, hiddenSkillCount } = buildFirstRunConfig({}, { applySkillPack: false });
    expect(hiddenSkillCount).toBe(0);
    expect(config.skills).toBeUndefined();
  });

  it("never re-hides a skill the user turned back on", () => {
    const cfg: DaisyClawConfig = {
      skills: { entries: { himalaya: { enabled: true } } },
    };
    const { config } = buildFirstRunConfig(cfg);
    expect(config.skills?.entries?.himalaya?.enabled).toBe(true);
  });
});
