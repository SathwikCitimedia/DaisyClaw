/**
 * Shortens tool output from questions Daisy has already answered, before each
 * model call.
 *
 * Every model call sends the whole conversation again. A web search returns
 * 20-40 KB of raw results, and once Daisy has answered with them her answer
 * carries what mattered. Yet the raw pages went back to the model on every
 * step of every later question: in one slow conversation they were 90% of
 * what each step sent, and each step took 25-45 seconds to read it all.
 *
 * Output from the question being worked on is left whole, so a reply never
 * loses what it is building on. Only what is sent changes; the saved
 * conversation keeps every result.
 */
import type { ImageContent, TextContent, ToolResultMessage } from "../../llm/types.js";
import type { AgentMessage } from "../runtime/index.js";
import type { ContextEvent, ExtensionAPI } from "../sessions/index.js";

/** How much of an answered result stays: enough to recall what it was about. */
const KEEP_CHARS = 1_200;
/** Results this short cost little to send again, so they stay whole. */
const MIN_CHARS_TO_SHORTEN = 2_000;

/** An assistant message that answered rather than asked for a tool. */
function isAnswer(message: AgentMessage): boolean {
  if (message.role !== "assistant") {
    return false;
  }
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return true;
  }
  return !content.some(
    (block) =>
      Boolean(block) &&
      typeof block === "object" &&
      (block as { type?: unknown }).type === "toolCall",
  );
}

function shortenToolResult(message: ToolResultMessage): ToolResultMessage | null {
  const texts: string[] = [];
  let images = 0;
  for (const block of message.content as ReadonlyArray<TextContent | ImageContent>) {
    if (block?.type === "text" && typeof block.text === "string") {
      texts.push(block.text);
    } else if (block?.type === "image") {
      images += 1;
    }
  }
  const text = texts.join("\n");
  const longText = text.length > MIN_CHARS_TO_SHORTEN;
  if (!longText && images === 0) {
    return null;
  }
  const kept = longText ? text.slice(0, KEEP_CHARS) : text;
  const left: string[] = [];
  if (longText) {
    left.push(`${text.length - kept.length} more characters`);
  }
  if (images > 0) {
    left.push(images === 1 ? "an image" : `${images} images`);
  }
  const note = `[Shortened: this result belongs to a question already answered, so ${left.join(
    " and ",
  )} of it are not shown. Run the tool again if the full result is needed.]`;
  return { ...message, content: [{ type: "text", text: kept ? `${kept}\n\n${note}` : note }] };
}

/**
 * Returns the messages with tool output from answered questions shortened, or
 * the same array when there is nothing to shorten.
 */
export function shortenAnsweredToolResults(messages: AgentMessage[]): AgentMessage[] {
  let lastAnswer = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (isAnswer(messages[index])) {
      lastAnswer = index;
      break;
    }
  }
  if (lastAnswer <= 0) {
    return messages;
  }
  let changed = false;
  const next = messages.map((message, index) => {
    if (index >= lastAnswer || message.role !== "toolResult") {
      return message;
    }
    const shortened = shortenToolResult(message as ToolResultMessage);
    if (!shortened) {
      return message;
    }
    changed = true;
    return shortened;
  });
  return changed ? next : messages;
}

/** Session extension that applies {@link shortenAnsweredToolResults} before each model call. */
export default function answeredToolResultsExtension(api: ExtensionAPI): void {
  api.on("context", (event: ContextEvent) => {
    const next = shortenAnsweredToolResults(event.messages);
    return next === event.messages ? undefined : { messages: next };
  });
}
