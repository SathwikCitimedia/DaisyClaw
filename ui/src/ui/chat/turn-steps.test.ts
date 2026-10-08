import { describe, expect, it } from "vitest";
import type { ChatItem, MessageGroup } from "../types/chat-types.ts";
import { buildChatItems, type BuildChatItemsProps } from "./build-chat-items.ts";
import { summarizeToolUse } from "./turn-steps.ts";

let clock = 0;
const at = () => ++clock * 1_000;

const user = (text: string) => ({ role: "user", content: text, timestamp: at() });
const said = (text: string) => ({ role: "assistant", content: text, timestamp: at() });
const callsTool = (text: string, name: string, id: string) => ({
  role: "assistant",
  content: [
    { type: "text", text },
    { type: "toolCall", id, name, arguments: { query: "the paradise tickets" } },
  ],
  timestamp: at(),
});
const toolResult = (name: string, id: string) => ({
  role: "toolResult",
  toolName: name,
  toolCallId: id,
  content: [{ type: "text", text: `${name} output` }],
  timestamp: at(),
});

function build(messages: unknown[], overrides: Partial<BuildChatItemsProps> = {}) {
  return buildChatItems({
    sessionKey: "main",
    messages,
    toolMessages: [],
    streamSegments: [],
    stream: null,
    streamStartedAt: null,
    showToolCalls: false,
    ...overrides,
  });
}

type Built = ReturnType<typeof build>;

function shape(items: Built): string[] {
  return items.map((item) =>
    item.kind === "group"
      ? `${item.role}:${(item as MessageGroup).messages.length}`
      : item.kind === "steps"
        ? `steps:${item.summary}`
        : item.kind,
  );
}

function stepsOf(items: Built) {
  return items.find((item): item is Extract<ChatItem, { kind: "steps" }> => item.kind === "steps");
}

function searchTurn() {
  return [
    user("Find me tickets for The Paradise at Art Theatre EPIQ"),
    callsTool("You're right! Let me search for that.", "web_search", "c1"),
    toolResult("web_search", "c1"),
    callsTool("Perfect! Now let me find the booking link:", "web_search", "c2"),
    toolResult("web_search", "c2"),
    said("Here is the direct booking link for Art Theatre EPIQ."),
  ];
}

describe("folding a finished reply", () => {
  it("shows only the answer, with the work behind it as one line", () => {
    const items = build(searchTurn());
    expect(shape(items)).toEqual(["user:1", "steps:Searched the web twice", "assistant:1"]);
    const answer = items.at(-1) as MessageGroup;
    expect((answer.messages[0].message as { content: string }).content).toBe(
      "Here is the direct booking link for Art Theatre EPIQ.",
    );
  });

  it("keeps every step inside the fold, tool output included", () => {
    const steps = stepsOf(build(searchTurn()))!;
    // Tool calls (with their narration) and results group together as one activity.
    expect(steps.groups.map((group) => [group.role, group.messages.length])).toEqual([["tool", 4]]);
  });

  it("folds the same way with tool output switched on", () => {
    expect(shape(build(searchTurn(), { showToolCalls: true }))).toEqual([
      "user:1",
      "steps:Searched the web twice",
      "assistant:1",
    ]);
  });

  it("leaves a reply that is still being worked on alone", () => {
    const live = searchTurn().slice(0, 4);
    const items = build(live, { awaitingReply: true });
    expect(items.some((item) => item.kind === "steps")).toBe(false);
    // Tool output stays hidden while it runs, as before.
    expect(shape(items).filter((entry) => entry.startsWith("tool"))).toEqual([]);
  });

  it("still folds earlier replies while a new one is running", () => {
    const items = build([...searchTurn(), user("Thanks! What time is the first show?")], {
      awaitingReply: true,
    });
    expect(shape(items).slice(0, 3)).toEqual([
      "user:1",
      "steps:Searched the web twice",
      "assistant:1",
    ]);
  });

  it("does not fold a reply that used no tools", () => {
    const items = build([user("Tell me a story"), said("Once upon a time…"), said("The end.")]);
    expect(shape(items)).toEqual(["user:1", "assistant:2"]);
  });

  it("keeps a separate message with real substance visible", () => {
    const plan = "Here is your plan:\n- Monday: gym\n- Tuesday: groceries";
    const items = build([
      user("Plan my week and set reminders"),
      said(plan),
      callsTool("Setting the reminders now.", "cron", "c1"),
      toolResult("cron", "c1"),
      said("Done, the reminders are set."),
    ]);
    expect(shape(items)).toEqual([
      "user:1",
      "assistant:1",
      "steps:Scheduled a task",
      "assistant:1",
    ]);
  });

  it("folds short narration sent as its own message", () => {
    const items = build([
      user("What's the weather?"),
      said("Let me check."),
      callsTool("", "web_fetch", "c1"),
      toolResult("web_fetch", "c1"),
      said("Sunny, 24°C."),
    ]);
    expect(shape(items)).toEqual(["user:1", "steps:Read a web page", "assistant:1"]);
  });

  it("keeps a message carrying a picture visible", () => {
    const question = user("Draw a cat");
    const drawing = callsTool("Drawing it now.", "image_generate", "c1");
    const result = toolResult("image_generate", "c1");
    const picture = {
      role: "assistant",
      content: [
        { type: "text", text: "Here it is" },
        { type: "image", url: "https://x.test/cat.png" },
      ],
      timestamp: at(),
    };
    const items = build([question, drawing, result, picture, said("Enjoy!")]);
    expect(shape(items)).toEqual(["user:1", "assistant:1", "steps:Made an image", "assistant:1"]);
  });

  it("does not fold while the find bar is filtering", () => {
    const items = build(searchTurn(), { searchOpen: true, searchQuery: "search" });
    expect(items.some((item) => item.kind === "steps")).toBe(false);
  });
});

describe("summarizeToolUse", () => {
  it("says what was done in plain words", () => {
    expect(summarizeToolUse(["web_search"])).toBe("Searched the web");
    expect(summarizeToolUse(["web_search", "web_search", "web_fetch"])).toBe(
      "Searched the web twice · Read a web page",
    );
    expect(summarizeToolUse(["exec", "bash", "web_fetch", "web_fetch"])).toBe(
      "Ran 2 commands · Read 2 web pages",
    );
  });

  it("names unknown tools and caps the line at three phrases", () => {
    expect(summarizeToolUse(["weather_lookup"])).toBe("Used weather lookup");
    expect(summarizeToolUse(["skill:weather", "skill:weather"])).toBe("Used weather ×2");
    expect(summarizeToolUse(["web_search", "web_fetch", "pdf", "tts", "cron"])).toBe(
      "Searched the web · Read a web page · Read a PDF · 2 more",
    );
  });
});

describe("a step that made something", () => {
  // The first meme rode along with the command that started the second one,
  // so the fold took its picture with it and only the last meme showed.
  it("keeps its words and picture in the reply while the command folds", () => {
    const items = build([
      user("Make a meme about Hyderabad traffic"),
      callsTool(
        "Here's your meme!\n\nMEDIA:/workspace/this-is-fine.png\n\nLet me make one more:",
        "exec",
        "c1",
      ),
      toolResult("exec", "c1"),
      said("And here's the Drake version!\n\nMEDIA:/workspace/drake.png"),
    ]);

    // The picture's message and the answer read as one block, in order.
    expect(shape(items)).toEqual(["user:1", "steps:Ran a command", "assistant:2"]);
    const made = items[2] as MessageGroup;
    const content =
      (made.messages[0]?.message as { content?: Array<{ type: string; text?: string }> })
        ?.content ?? [];
    expect(content.map((block) => block.type)).toEqual(["text"]);
    expect(content[0]?.text).toContain("MEDIA:/workspace/this-is-fine.png");
    expect(JSON.stringify(made.messages[1]?.message)).toContain("drake.png");
  });

  it("still folds plain narration that made nothing", () => {
    const items = build(searchTurn());

    expect(shape(items)).toEqual(["user:1", "steps:Searched the web twice", "assistant:1"]);
  });
});
