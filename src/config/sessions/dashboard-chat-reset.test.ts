// The desktop app's own chat must not start over every morning.
import { describe, expect, it } from "vitest";
import { resolveSessionResetPolicy } from "./reset-policy.js";
import { resolveChannelResetConfig } from "./reset.js";

function policyFor(
  channel: string,
  sessionCfg?: Parameters<typeof resolveChannelResetConfig>[0]["sessionCfg"],
) {
  return resolveSessionResetPolicy({
    sessionCfg,
    resetType: "direct",
    resetOverride: resolveChannelResetConfig({ sessionCfg, channel }),
  });
}

describe("dashboard chat reset", () => {
  it("picks up where it left off instead of resetting at 4am", () => {
    const policy = policyFor("webchat");
    expect(policy.mode).toBe("idle");
    // Several quiet days, not several hours.
    expect(policy.idleMinutes).toBeGreaterThanOrEqual(24 * 60);
  });

  it("leaves messaging channels on their daily rhythm", () => {
    for (const channel of ["whatsapp", "telegram", "discord"]) {
      expect(policyFor(channel).mode, channel).toBe("daily");
    }
  });

  it("still lets an explicit setting win", () => {
    const policy = policyFor("webchat", {
      resetByChannel: { webchat: { mode: "daily", atHour: 6 } },
    } as never);
    expect(policy.mode).toBe("daily");
    expect(policy.atHour).toBe(6);
  });

  it("is unaffected for a channel nobody has an opinion about", () => {
    expect(resolveChannelResetConfig({ channel: "irc" })).toBeUndefined();
  });
});
