// Telegram tests cover channel actions.contract plugin behavior.
import { installChannelActionsContractSuite } from "daisyclaw/plugin-sdk/channel-test-helpers";
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
import { describe } from "vitest";
import { telegramPlugin } from "../api.js";

describe("telegram actions contract", () => {
  installChannelActionsContractSuite({
    plugin: telegramPlugin,
    cases: [
      {
        name: "exposes configured Telegram actions and capabilities",
        cfg: {
          channels: {
            telegram: {
              botToken: "123:telegram-test-token",
            },
          },
        } as DaisyClawConfig,
        expectedActions: ["send", "poll", "react", "delete", "edit", "topic-create", "topic-edit"],
        expectedCapabilities: ["delivery-pin", "presentation"],
      },
    ],
  });
});
