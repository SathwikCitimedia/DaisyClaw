import { describe, expect, it } from "vitest";
import {
  collectLiveAssistantMediaUrls,
  resolveMergedAssistantText,
  withLiveAssistantMedia,
} from "./live-chat-projector.js";

describe("live reply media", () => {
  // Live events carry the text with `MEDIA:` lines taken out and the paths
  // alongside, so a meme the assistant made only showed once the reply ended
  // and the page reloaded.
  it("puts an image back into the live text where it turned up", () => {
    const text = withLiveAssistantMedia("Here's your meme!", ["C:\\workspace\\meme.png"]);

    expect(text).toBe("Here's your meme!\n\nMEDIA:C:\\workspace\\meme.png\n\n");
  });

  it("keeps the image with its words as the reply goes on", () => {
    const media = ["C:\\workspace\\meme.png"];
    const first = withLiveAssistantMedia("Here's your meme!", media);
    const merged = resolveMergedAssistantText({
      previousText: first,
      nextText: "Here's your meme! Want another?",
      nextDelta: " Want another?",
    });

    const next = withLiveAssistantMedia(merged, media);

    expect(next.indexOf("MEDIA:")).toBeLessThan(next.indexOf("Want another?"));
    expect(next.match(/MEDIA:/g)).toHaveLength(1);
  });

  it("brings an image back if a rewrite of the text dropped it", () => {
    expect(withLiveAssistantMedia("Rewritten answer", ["https://x.test/a.png"])).toContain(
      "MEDIA:https://x.test/a.png",
    );
  });

  it("reads image paths from either field, once each", () => {
    expect(
      collectLiveAssistantMediaUrls({
        mediaUrls: [" a.png ", "b.png", "a.png", 3],
        mediaUrl: "c.png",
      }),
    ).toEqual(["a.png", "b.png", "c.png"]);
    expect(collectLiveAssistantMediaUrls({})).toEqual([]);
  });
});
