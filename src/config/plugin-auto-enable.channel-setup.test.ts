// Covers the consumer-build rule that lets channel setup run at all.
//
// The desktop app has no terminal: a channel is set up from the dashboard, and
// the setup surface lives on the channel's own plugin. If the plugin only loads
// once the channel is configured, the user can never reach the step that would
// configure it, and the gateway answers "web login provider is not available".
// That shipped to users twice, so the rule is pinned here.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyPluginAutoEnable } from "./plugin-auto-enable.js";
import {
  makeIsolatedEnv,
  makeRegistry,
  resetPluginAutoEnableTestState,
} from "./plugin-auto-enable.test-helpers.js";
import type { DaisyClawConfig } from "./types.daisyclaw.js";

const CHANNEL_REGISTRY = makeRegistry([
  { id: "whatsapp", channels: ["whatsapp"] },
  { id: "telegram", channels: ["telegram"] },
  { id: "memory-core", channels: [] },
]);

function applyInConsumerBuild(config: DaisyClawConfig, envOverrides: NodeJS.ProcessEnv = {}) {
  return applyPluginAutoEnable({
    config,
    env: makeIsolatedEnv({ DAISYCLAW_PRELOAD_CHANNEL_PLUGINS: "1", ...envOverrides }),
    manifestRegistry: CHANNEL_REGISTRY,
  });
}

function enabledEntries(result: { config: DaisyClawConfig }): Record<string, boolean> {
  const entries = result.config.plugins?.entries ?? {};
  return Object.fromEntries(
    Object.entries(entries).map(([id, entry]) => [
      id,
      (entry as { enabled?: boolean } | undefined)?.enabled === true,
    ]),
  );
}

beforeEach(() => {
  resetPluginAutoEnableTestState();
});

afterEach(() => {
  resetPluginAutoEnableTestState();
});

describe("channel setup auto-enable in consumer builds", () => {
  it("enables channel plugins on a config that has never been touched", () => {
    const result = applyInConsumerBuild({} as DaisyClawConfig);
    const entries = enabledEntries(result);
    expect(entries.whatsapp).toBe(true);
    expect(entries.telegram).toBe(true);
  });

  it("says why, so the reason shows up in the startup log", () => {
    const result = applyInConsumerBuild({} as DaisyClawConfig);
    expect(result.autoEnabledReasons.whatsapp?.join(" ")).toContain("setup runs in the app");
  });

  it("leaves plugins without channels alone", () => {
    const result = applyInConsumerBuild({} as DaisyClawConfig);
    expect(enabledEntries(result)["memory-core"]).not.toBe(true);
  });

  it("respects a channel the user switched off", () => {
    const result = applyInConsumerBuild({
      channels: { whatsapp: { enabled: false } },
    } as unknown as DaisyClawConfig);
    const entries = enabledEntries(result);
    expect(entries.whatsapp).not.toBe(true);
    expect(entries.telegram).toBe(true);
  });

  it("respects a plugin the user disabled explicitly", () => {
    const result = applyInConsumerBuild({
      plugins: { entries: { whatsapp: { enabled: false } } },
    } as unknown as DaisyClawConfig);
    expect(enabledEntries(result).whatsapp).not.toBe(true);
  });

  it("does nothing outside consumer builds", () => {
    const result = applyPluginAutoEnable({
      config: {} as DaisyClawConfig,
      env: makeIsolatedEnv({ DAISYCLAW_PRELOAD_CHANNEL_PLUGINS: "0" }),
      manifestRegistry: CHANNEL_REGISTRY,
    });
    expect(enabledEntries(result).whatsapp).not.toBe(true);
  });
});
