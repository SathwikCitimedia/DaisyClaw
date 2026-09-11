import { describe, expect, it } from "vitest";
import { isConsumerLockdownActive } from "./consumer-lockdown.js";

describe("isConsumerLockdownActive", () => {
  it("is off by default in dev builds", () => {
    expect(isConsumerLockdownActive({})).toBe(false);
  });

  it("force-enables via DAISYCLAW_CONSUMER_LOCKDOWN", () => {
    expect(isConsumerLockdownActive({ DAISYCLAW_CONSUMER_LOCKDOWN: "1" })).toBe(true);
    expect(isConsumerLockdownActive({ DAISYCLAW_CONSUMER_LOCKDOWN: "true" })).toBe(true);
    expect(isConsumerLockdownActive({ DAISYCLAW_CONSUMER_LOCKDOWN: " TRUE " })).toBe(true);
  });

  it("ignores non-enabling values", () => {
    expect(isConsumerLockdownActive({ DAISYCLAW_CONSUMER_LOCKDOWN: "0" })).toBe(false);
    expect(isConsumerLockdownActive({ DAISYCLAW_CONSUMER_LOCKDOWN: "false" })).toBe(false);
    expect(isConsumerLockdownActive({ DAISYCLAW_CONSUMER_LOCKDOWN: "yes" })).toBe(false);
    expect(isConsumerLockdownActive({ DAISYCLAW_CONSUMER_LOCKDOWN: "" })).toBe(false);
  });
});
