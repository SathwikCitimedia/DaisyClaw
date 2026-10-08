import { afterEach, describe, expect, it, vi } from "vitest";
import {
  resetFullMessageTextForTest,
  resolveFullMessageText,
  setFullMessageClient,
} from "./full-message-text.ts";

afterEach(() => {
  resetFullMessageTextForTest();
});

const fullAnswer = "The whole answer, to the very end.";

function clientAnswering(result: unknown) {
  return { request: vi.fn(async () => result) } as unknown as Parameters<
    typeof setFullMessageClient
  >[0] & { request: ReturnType<typeof vi.fn> };
}

describe("resolveFullMessageText", () => {
  it("fetches a cut message once and shows the whole of it from then on", async () => {
    const client = clientAnswering({
      ok: true,
      message: { role: "assistant", content: [{ type: "text", text: fullAnswer }] },
    });
    setFullMessageClient(client);
    const onReady = vi.fn();
    const target = { sessionKey: "main", messageId: "msg-1", onReady };

    expect(resolveFullMessageText(target)).toBeUndefined();
    expect(resolveFullMessageText(target)).toBeUndefined();
    await vi.waitFor(() => expect(onReady).toHaveBeenCalled());

    expect(resolveFullMessageText(target)).toBe(fullAnswer);
    expect(client!.request).toHaveBeenCalledTimes(1);
    expect(client!.request).toHaveBeenCalledWith(
      "chat.message.get",
      expect.objectContaining({ sessionKey: "main", messageId: "msg-1" }),
    );
  });

  it("keeps the cut text when the full message cannot be had", async () => {
    setFullMessageClient(clientAnswering({ ok: false, unavailableReason: "oversized" }));
    const onReady = vi.fn();
    const target = { sessionKey: "main", messageId: "msg-2", onReady };

    resolveFullMessageText(target);
    await vi.waitFor(() => expect(onReady).toHaveBeenCalled());

    expect(resolveFullMessageText(target)).toBeUndefined();
  });

  it("asks again after a dropped connection, and waits for one", async () => {
    expect(resolveFullMessageText({ sessionKey: "main", messageId: "msg-3" })).toBeUndefined();

    const failing = {
      request: vi.fn(async () => {
        throw new Error("closed");
      }),
    };
    setFullMessageClient(failing as never);
    resolveFullMessageText({ sessionKey: "main", messageId: "msg-3" });
    await vi.waitFor(() => expect(failing.request).toHaveBeenCalled());
    await Promise.resolve();

    const working = clientAnswering({ ok: true, message: { role: "assistant", text: fullAnswer } });
    setFullMessageClient(working);
    resolveFullMessageText({ sessionKey: "main", messageId: "msg-3" });
    await vi.waitFor(() => expect(working!.request).toHaveBeenCalled());
  });
});
