import { describe, expect, it } from "vitest";
import {
  extractFirstUserMessageText,
  isRepairableUntitledSessionKey,
} from "./session-title-repair.js";

describe("isRepairableUntitledSessionKey", () => {
  it("targets only uuid-named control-UI chats", () => {
    expect(isRepairableUntitledSessionKey("agent:main:dashboard:b48a8727-1f0b-41a7")).toBe(true);
    expect(isRepairableUntitledSessionKey("dashboard:53fe966a")).toBe(true);
    expect(isRepairableUntitledSessionKey("agent:main:webchat:abc")).toBe(true);
  });

  it("leaves structural and channel sessions alone", () => {
    expect(isRepairableUntitledSessionKey("agent:main:main")).toBe(false);
    expect(isRepairableUntitledSessionKey("global")).toBe(false);
    expect(isRepairableUntitledSessionKey("agent:main:whatsapp:direct:+911234")).toBe(false);
    expect(isRepairableUntitledSessionKey("agent:main:cron:abc")).toBe(false);
    expect(isRepairableUntitledSessionKey("")).toBe(false);
  });
});

describe("extractFirstUserMessageText", () => {
  it("returns the first user message, skipping assistant and system records", () => {
    const entries = [
      { record: { type: "session" } },
      { record: { message: { role: "assistant", content: "Hi there" } } },
      { record: { message: { role: "user", content: "  fix the login bug  " } } },
      { record: { message: { role: "user", content: "second message" } } },
    ];
    expect(extractFirstUserMessageText(entries)).toBe("fix the login bug");
  });

  it("joins text blocks and ignores non-text content", () => {
    const entries = [
      {
        record: {
          message: {
            role: "user",
            content: [
              { type: "image", url: "x" },
              { type: "text", text: "plan my" },
              { type: "text", text: "trip to Goa" },
            ],
          },
        },
      },
    ];
    expect(extractFirstUserMessageText(entries)).toBe("plan my trip to Goa");
  });

  it("skips empty user messages and returns null when none has text", () => {
    expect(
      extractFirstUserMessageText([
        { record: { message: { role: "user", content: "   " } } },
        { record: { message: { role: "user", content: [{ type: "image", url: "x" }] } } },
      ]),
    ).toBeNull();
    expect(extractFirstUserMessageText([])).toBeNull();
  });
});
