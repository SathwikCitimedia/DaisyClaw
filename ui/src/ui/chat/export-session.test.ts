import { describe, expect, it, vi } from "vitest";
import { exportSessionChat } from "./export-session.ts";
import { buildChatExportFileName, buildChatMarkdown } from "./export.ts";

describe("chat export file", () => {
  it("names the file after the chat and the day", () => {
    expect(buildChatExportFileName("Trip to Goa!", new Date(2026, 2, 5))).toBe(
      "trip-to-goa-2026-03-05.md",
    );
    expect(buildChatExportFileName("   ", new Date(2026, 11, 31))).toBe("chat-2026-12-31.md");
    expect(buildChatExportFileName("Réunion d'équipe", new Date(2026, 0, 2))).toBe(
      "réunion-d-équipe-2026-01-02.md",
    );
  });

  it("keeps the conversation and leaves out tool output and empty turns", () => {
    const markdown = buildChatMarkdown(
      [
        { role: "user", content: "Plan my week" },
        { role: "toolResult", content: '{"raw":"calendar dump"}' },
        { role: "assistant", content: "   " },
        { role: "assistant", content: "Here is your plan." },
      ],
      "Daisy",
      { title: "Weekly plan" },
    );
    expect(markdown).toBe(`# Weekly plan

Chat with Daisy

## You

Plan my week

## Daisy

Here is your plan.
`);
  });

  it("has nothing to save for a chat of tool output only", () => {
    expect(buildChatMarkdown([{ role: "toolResult", content: "x" }], "Daisy")).toBeNull();
  });
});

describe("exportSessionChat", () => {
  it("reads the whole chat from the gateway and saves it under the chat's name", async () => {
    const request = vi.fn().mockResolvedValue({
      messages: [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi there" },
      ],
    });
    const save = vi.fn().mockReturnValue(true);
    const result = await exportSessionChat({
      client: { request },
      sessionKey: "agent:main:dashboard:1",
      agentId: "main",
      title: "Greetings",
      assistantName: "Daisy",
      save,
    });
    expect(result).toEqual({ ok: true });
    expect(request).toHaveBeenCalledWith("chat.history", {
      sessionKey: "agent:main:dashboard:1",
      agentId: "main",
      limit: 1000,
    });
    expect(save).toHaveBeenCalledWith(
      [
        { role: "user", content: "hello" },
        { role: "assistant", content: "hi there" },
      ],
      "Daisy",
      { title: "Greetings" },
    );
  });

  it("says when there is nothing to save", async () => {
    const result = await exportSessionChat({
      client: { request: vi.fn().mockResolvedValue({ messages: [] }) },
      sessionKey: "main",
      assistantName: "Daisy",
      save: () => false,
    });
    expect(result).toEqual({ ok: false, reason: "empty" });
  });

  it("reports a failed read with the gateway's reason", async () => {
    const result = await exportSessionChat({
      client: {
        request: vi.fn().mockRejectedValue(new Error("GatewayRequestError: session not found")),
      },
      sessionKey: "main",
      assistantName: "Daisy",
      save: vi.fn(),
    });
    expect(result).toEqual({ ok: false, reason: "failed", error: "session not found" });
  });

  it("does not try without a connection", async () => {
    const result = await exportSessionChat({
      client: null,
      sessionKey: "main",
      assistantName: "Daisy",
    });
    expect(result).toEqual({ ok: false, reason: "disconnected" });
  });
});
