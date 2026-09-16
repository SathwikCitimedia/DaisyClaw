import { describe, expect, it, vi } from "vitest";
import { describeEditFailure, submitEditedTurn, type EditFork } from "./edit-turn.ts";

function harness() {
  const calls: string[] = [];
  return {
    calls,
    hide: vi.fn(() => calls.push("hide")),
    setBusy: vi.fn((busy: boolean) => calls.push(busy ? "busy" : "idle")),
    onFailure: vi.fn((_text: string, _error: string) => calls.push("failure")),
    draftChange: vi.fn((_text: string) => calls.push("draft")),
    sendText: vi.fn((_text: string) => calls.push("send")),
  };
}

describe("submitEditedTurn", () => {
  // The Sept 15 laptop report: edit, Enter, question and answer vanish, toast
  // "Message edit failed: unknown method: sessions.forkFromMessage". The turn was
  // hidden before the gateway had accepted the fork.
  it("keeps the turn visible and reopens the editor when the fork is rejected", async () => {
    const h = harness();
    const fork: EditFork = vi.fn(async () => ({
      ok: false as const,
      error: "unknown method: sessions.forkFromMessage",
    }));

    const ok = await submitEditedTurn({
      text: "edited question",
      target: { messageId: "m1" },
      fork,
      ...h,
    });

    expect(ok).toBe(false);
    expect(h.hide).not.toHaveBeenCalled();
    expect(h.sendText).not.toHaveBeenCalled();
    expect(h.onFailure).toHaveBeenCalledWith(
      "edited question",
      "unknown method: sessions.forkFromMessage",
    );
    expect(h.calls).toEqual(["busy", "idle", "failure"]);
  });

  it("treats a thrown fork like a rejection", async () => {
    const h = harness();
    const fork: EditFork = vi.fn(async () => {
      throw new Error("GatewayRequestError: gateway not connected");
    });

    await submitEditedTurn({ text: "again", target: { lastUser: true }, fork, ...h });

    expect(h.hide).not.toHaveBeenCalled();
    expect(h.onFailure).toHaveBeenCalledWith("again", "gateway not connected");
    expect(h.setBusy).toHaveBeenLastCalledWith(false);
  });

  it("hides the old turn exactly once, after the fork is accepted and before the send", async () => {
    const h = harness();
    const fork: EditFork = vi.fn(async (_target, text, hooks) => {
      h.calls.push("fork");
      hooks.onForked();
      hooks.onForked(); // a careless caller must not double-hide
      h.calls.push(`send:${text}`);
      return { ok: true as const };
    });

    const ok = await submitEditedTurn({
      text: "edited question",
      target: { messageId: "m1" },
      fork,
      ...h,
    });

    expect(ok).toBe(true);
    expect(h.hide).toHaveBeenCalledTimes(1);
    expect(h.onFailure).not.toHaveBeenCalled();
    expect(h.calls).toEqual(["busy", "fork", "hide", "send:edited question", "idle"]);
  });

  it("falls back to a plain resend when the message cannot be forked", async () => {
    const h = harness();
    const fork: EditFork = vi.fn(async () => ({ ok: true as const }));

    await submitEditedTurn({ text: "plain", target: null, fork, ...h });

    expect(fork).not.toHaveBeenCalled();
    expect(h.calls).toEqual(["hide", "send"]);
    expect(h.sendText).toHaveBeenCalledWith("plain");
  });

  it("puts the text in the composer when nothing can send it", async () => {
    const h = harness();

    await submitEditedTurn({
      text: "plain",
      target: { messageId: "m1" },
      hide: h.hide,
      setBusy: h.setBusy,
      onFailure: h.onFailure,
      draftChange: h.draftChange,
    });

    expect(h.calls).toEqual(["hide", "draft"]);
  });
});

describe("describeEditFailure", () => {
  it("strips the transport prefix and never returns an empty string", () => {
    expect(describeEditFailure(new Error("GatewayRequestError: unknown method: x"))).toBe(
      "unknown method: x",
    );
    expect(describeEditFailure("  ")).toBe("Unknown error");
    expect(describeEditFailure(undefined)).toBe("Unknown error");
  });
});
