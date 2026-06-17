// Qqbot plugin module implements narrowing behavior.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
import type { PluginRuntime } from "daisyclaw/plugin-sdk/core";
import type { GatewayAccount } from "../engine/types.js";
import type { ResolvedQQBotAccount } from "../types.js";

/**
 * Map resolved plugin account to the engine gateway account shape (single assertion on nested config).
 */
export function toGatewayAccount(account: ResolvedQQBotAccount): GatewayAccount {
  return {
    accountId: account.accountId,
    appId: account.appId,
    clientSecret: account.clientSecret,
    markdownSupport: account.markdownSupport,
    systemPrompt: account.systemPrompt,
    config: account.config as GatewayAccount["config"],
  };
}

/**
 * Persist DaisyClaw config through the injected plugin runtime (typed entry point).
 */
export async function writeDaisyClawConfigThroughRuntime(
  runtime: PluginRuntime,
  cfg: DaisyClawConfig,
): Promise<void> {
  await runtime.config.replaceConfigFile({
    nextConfig: cfg,
    afterWrite: { mode: "auto" },
  });
}
