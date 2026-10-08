import type { AgentMessage } from "daisyclaw/plugin-sdk/agent-core";
import { describe, expect, it } from "vitest";
import answeredToolResultsExtension, {
  shortenAnsweredToolResults,
} from "./answered-tool-results.js";

const user = (text: string) => ({ role: "user", content: text, timestamp: 1 }) as AgentMessage;
const searchCall = (id: string) =>
  ({
    role: "assistant",
    content: [{ type: "toolCall", id, name: "web_search", arguments: { query: "q" } }],
    stopReason: "toolUse",
    timestamp: 1,
  }) as unknown as AgentMessage;
const searchResult = (id: string, text: string, extra: unknown[] = []) =>
  ({
    role: "toolResult",
    toolCallId: id,
    toolName: "web_search",
    content: [{ type: "text", text }, ...extra],
    isError: false,
    timestamp: 1,
  }) as unknown as AgentMessage;
const answer = (text: string) =>
  ({
    role: "assistant",
    content: [{ type: "text", text }],
    stopReason: "stop",
    timestamp: 1,
  }) as unknown as AgentMessage;

function resultText(message: AgentMessage): string {
  const content = (message as { content: Array<{ type: string; text?: string }> }).content;
  return content.map((block) => block.text ?? `<${block.type}>`).join("");
}

const bigPages = "result ".repeat(4_000);

describe("shortenAnsweredToolResults", () => {
  it("shortens search pages from an answered question and keeps the current one whole", () => {
    const messages = [
      user("iphone 18 pro max prices in hyderabad"),
      searchCall("old"),
      searchResult("old", bigPages),
      answer("Here are the prices."),
      user("research this further"),
      searchCall("new"),
      searchResult("new", bigPages),
    ];

    const sent = shortenAnsweredToolResults(messages);

    expect(resultText(sent[2]).length).toBeLessThan(1_500);
    expect(resultText(sent[2])).toContain("belongs to a question already answered");
    expect(resultText(sent[2]).startsWith(bigPages.slice(0, 1_200))).toBe(true);
    expect(resultText(sent[6])).toBe(bigPages);
    // The pairing the model relies on is untouched.
    expect(sent).toHaveLength(messages.length);
    expect((sent[2] as { toolCallId?: string }).toolCallId).toBe("old");
  });

  it("leaves short results, and everything before the first answer, alone", () => {
    const short = [
      user("hi"),
      searchCall("a"),
      searchResult("a", "small"),
      answer("ok"),
      user("next"),
    ];
    expect(shortenAnsweredToolResults(short)).toBe(short);

    const firstQuestion = [user("hi"), searchCall("a"), searchResult("a", bigPages)];
    expect(shortenAnsweredToolResults(firstQuestion)).toBe(firstQuestion);
  });

  it("drops images from answered results with a note", () => {
    const messages = [
      user("what is on screen"),
      searchCall("shot"),
      searchResult("shot", "", [{ type: "image", data: "AAAA", mimeType: "image/png" }]),
      answer("A login page."),
      user("thanks"),
    ];

    const sent = shortenAnsweredToolResults(messages);

    expect(resultText(sent[2])).toContain("an image");
    expect(resultText(sent[2])).not.toContain("<image>");
  });

  it("never changes the saved messages it was given", () => {
    const old = searchResult("old", bigPages);
    const messages = [user("q"), searchCall("old"), old, answer("a"), user("q2")];

    shortenAnsweredToolResults(messages);

    expect(resultText(old)).toBe(bigPages);
  });

  it("applies before each model call as a session extension", () => {
    let handler: ((event: { messages: AgentMessage[] }) => unknown) | undefined;
    answeredToolResultsExtension({
      on: (_event: string, fn: typeof handler) => {
        handler = fn;
      },
    } as never);
    const messages = [user("q"), searchCall("old"), searchResult("old", bigPages), answer("a")];

    const result = handler?.({ messages: [...messages, user("q2")] }) as
      | { messages: AgentMessage[] }
      | undefined;

    expect(result?.messages[2] && resultText(result.messages[2]).length).toBeLessThan(1_500);
    expect(handler?.({ messages: [user("only")] })).toBeUndefined();
  });
});
