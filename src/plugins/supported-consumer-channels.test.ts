// The product offers only the channels it can actually help someone set up.
import { describe, expect, it } from "vitest";
import {
  SUPPORTED_CONSUMER_CHANNEL_IDS,
  isSupportedConsumerChannel,
} from "./channel-plugin-preload.js";

describe("supported consumer channels", () => {
  it("matches the six the setup wizard offers", () => {
    expect([...SUPPORTED_CONSUMER_CHANNEL_IDS].toSorted()).toEqual([
      "discord",
      "googlechat",
      "signal",
      "slack",
      "telegram",
      "whatsapp",
    ]);
  });

  it("does not offer iMessage, which cannot run on Windows", () => {
    expect(isSupportedConsumerChannel("imessage")).toBe(false);
  });

  it("does not offer networks a customer will never use", () => {
    for (const channel of ["nostr", "irc", "tlon", "zalo", "msteams", "feishu", "twitch"]) {
      expect(isSupportedConsumerChannel(channel), channel).toBe(false);
    }
  });

  it("ignores case and stray spacing from plugin metadata", () => {
    expect(isSupportedConsumerChannel(" WhatsApp ")).toBe(true);
  });
});
