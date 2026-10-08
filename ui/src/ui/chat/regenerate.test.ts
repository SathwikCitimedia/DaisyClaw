import { describe, expect, it } from "vitest";
import type { MessageGroup } from "../types/chat-types.ts";
import { resolveRegenerateTurn } from "./regenerate.ts";

function group(key: string, role: string, messages: unknown[]): MessageGroup {
  return {
    kind: "group",
    key,
    role,
    messages: messages.map((message, index) => ({ message, key: `${key}:${index}` })),
    timestamp: 0,
    isStreaming: false,
  };
}

const readText = (item: MessageGroup) =>
  item.messages
    .map((entry) => {
      const content = (entry.message as { content?: unknown }).content;
      return typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content
              .filter((part) => (part as { type?: string }).type === "text")
              .map((part) => (part as { text?: string }).text ?? "")
              .join("")
          : "";
    })
    .join("\n");

describe("resolveRegenerateTurn", () => {
  it("asks the latest question again for the latest reply", () => {
    const items = [
      group("u1", "user", [{ role: "user", content: "first" }]),
      group("a1", "assistant", [{ role: "assistant", content: "one" }]),
      group("u2", "user", [{ role: "user", content: "What is the capital of France?" }]),
      group("a2", "assistant", [{ role: "assistant", content: "Paris" }]),
    ];
    expect(resolveRegenerateTurn(items, "a2", readText)).toMatchObject({
      userIndex: 2,
      text: "What is the capital of France?",
    });
  });

  it("is not offered while a newer question is waiting for its answer", () => {
    const items = [
      group("u1", "user", [{ role: "user", content: "first" }]),
      group("a1", "assistant", [{ role: "assistant", content: "one" }]),
      group("u2", "user", [{ role: "user", content: "second" }]),
    ];
    expect(resolveRegenerateTurn(items, "a1", readText)).toBeNull();
  });

  it("is not offered when the question carried a photo or file", () => {
    const withImage = [
      group("u1", "user", [
        {
          role: "user",
          content: [
            { type: "text", text: "What is in this photo?" },
            { type: "image", url: "blob:1" },
          ],
        },
      ]),
      group("a1", "assistant", [{ role: "assistant", content: "A cat." }]),
    ];
    expect(resolveRegenerateTurn(withImage, "a1", readText)).toBeNull();

    const inlinePlaceholder = [
      group("u1", "user", [
        { role: "user", content: [{ type: "text", text: "Attached image: receipt.png" }] },
      ]),
      group("a1", "assistant", [{ role: "assistant", content: "Total is 20." }]),
    ];
    expect(resolveRegenerateTurn(inlinePlaceholder, "a1", readText)).toBeNull();

    const channelMedia = [
      group("u1", "user", [{ role: "user", content: "see this", MediaPaths: ["/tmp/a.jpg"] }]),
      group("a1", "assistant", [{ role: "assistant", content: "ok" }]),
    ];
    expect(resolveRegenerateTurn(channelMedia, "a1", readText)).toBeNull();
  });

  it("is not offered for a slash command or an empty question", () => {
    const command = [
      group("u1", "user", [{ role: "user", content: "/status" }]),
      group("a1", "assistant", [{ role: "assistant", content: "All good" }]),
    ];
    expect(resolveRegenerateTurn(command, "a1", readText)).toBeNull();
    expect(resolveRegenerateTurn(command, undefined, readText)).toBeNull();
    const noQuestion = [group("a1", "assistant", [{ role: "assistant", content: "Welcome" }])];
    expect(resolveRegenerateTurn(noQuestion, "a1", readText)).toBeNull();
  });
});
