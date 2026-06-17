// Qqbot plugin module implements qqbot test support behavior.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";

export function makeQqbotSecretRefConfig(): DaisyClawConfig {
  return {
    channels: {
      qqbot: {
        appId: "123456",
        clientSecret: {
          source: "env",
          provider: "default",
          id: "QQBOT_CLIENT_SECRET",
        },
      },
    },
  } as DaisyClawConfig;
}

export function makeQqbotDefaultAccountConfig(): DaisyClawConfig {
  return {
    channels: {
      qqbot: {
        defaultAccount: "bot2",
        accounts: {
          bot2: { appId: "123456" },
        },
      },
    },
  } as DaisyClawConfig;
}
