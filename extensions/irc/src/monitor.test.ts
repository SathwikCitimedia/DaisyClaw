// Irc tests cover monitor plugin behavior.
import { describe, expect, it } from "vitest";
import { resolveIrcInboundTarget } from "./monitor.js";

describe("irc monitor inbound target", () => {
  it("keeps channel target for group messages", () => {
    expect(
      resolveIrcInboundTarget({
        target: "#daisyclaw",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: true,
      target: "#daisyclaw",
      rawTarget: "#daisyclaw",
    });
  });

  it("maps DM target to sender nick and preserves raw target", () => {
    expect(
      resolveIrcInboundTarget({
        target: "daisyclaw-bot",
        senderNick: "alice",
      }),
    ).toEqual({
      isGroup: false,
      target: "alice",
      rawTarget: "daisyclaw-bot",
    });
  });

  it("falls back to raw target when sender nick is empty", () => {
    expect(
      resolveIrcInboundTarget({
        target: "daisyclaw-bot",
        senderNick: " ",
      }),
    ).toEqual({
      isGroup: false,
      target: "daisyclaw-bot",
      rawTarget: "daisyclaw-bot",
    });
  });
});
