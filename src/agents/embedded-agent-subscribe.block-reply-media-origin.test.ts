// Block replies say whether their media came from the assistant's own text, so
// the gateway can show it from the saved message instead of saving a copy that
// split the conversation and lost the image on reload.
import { describe, expect, it, vi } from "vitest";
import { getReplyPayloadMetadata } from "../auto-reply/reply-payload.js";
import {
  createTextEndBlockReplyHarness,
  emitAssistantTextDelta,
  emitAssistantTextEnd,
} from "./embedded-agent-subscribe.e2e-harness.js";

type BlockReply = { text?: string; mediaUrls?: string[] };

// Streams one assistant message the way a provider does: text, the end of the
// text, then the end of the message, which is where `MEDIA:` lines are read.
function streamAssistantMessage(emit: (evt: unknown) => void, text: string) {
  const message = { role: "assistant", content: [{ type: "text", text }] };
  emit({ type: "message_start", message });
  emitAssistantTextDelta({ emit, delta: text });
  emitAssistantTextEnd({ emit });
  emit({ type: "message_end", message });
}

function blockReplies(onBlockReply: ReturnType<typeof vi.fn>): BlockReply[] {
  return onBlockReply.mock.calls.map((call) => call[0] as BlockReply);
}

describe("block reply media origin", () => {
  it("marks media the assistant named with a MEDIA line", async () => {
    const onBlockReply = vi.fn();
    const { emit } = createTextEndBlockReplyHarness({ onBlockReply });

    streamAssistantMessage(
      emit,
      "Here's your meme!\n\nMEDIA:/workspace/meme.png\n\n---\n\nLet me make one more.",
    );

    await vi.waitFor(() =>
      expect(blockReplies(onBlockReply).some((reply) => reply.mediaUrls?.length)).toBe(true),
    );
    const withMedia = blockReplies(onBlockReply).find((reply) => reply.mediaUrls?.length);
    expect(withMedia?.mediaUrls).toEqual(["/workspace/meme.png"]);
    expect(getReplyPayloadMetadata(withMedia as object)?.mediaFromAssistantText).toBe(true);
  });

  it("leaves text-only block replies unmarked", async () => {
    const onBlockReply = vi.fn();
    const { emit } = createTextEndBlockReplyHarness({ onBlockReply });

    streamAssistantMessage(emit, "Just words.");

    await vi.waitFor(() => expect(onBlockReply).toHaveBeenCalled());
    for (const reply of blockReplies(onBlockReply)) {
      expect(getReplyPayloadMetadata(reply as object)?.mediaFromAssistantText).toBe(undefined);
    }
  });
});
