// Control UI chat module folds the work behind a finished reply.
//
// A reply that used tools arrives as several messages: short narration
// ("Let me search for that…"), tool calls, tool output, more narration, and
// finally the answer. Left as they are, they read as a log instead of a reply.
// Once the reply is finished, everything before the answer folds into one line
// ("Searched the web twice · Read a web page") that opens to show the steps.
// The reply still in progress is left alone, so the user can watch it work.
//
// Folding never hides something the user needs: replies that used no tool are
// left whole, and a separate message with real substance, or one carrying a
// picture, file or other media, stays where it is. Narration that rides along
// with a tool call (the same message) is part of the step and folds with it;
// with tool output switched off it used to be hidden outright. When that
// message also shows something it made (a meme, a chart), its words and
// picture stay in the reply and only the tool call folds.
import type { ChatItem, MessageGroup } from "../types/chat-types.ts";
import { extractTextCached } from "./message-extract.ts";
import { normalizeMessage } from "./message-normalizer.ts";
import { normalizeRoleForGrouping } from "./role-normalizer.ts";
import { extractToolCardsCached } from "./tool-cards.ts";

type MessageItem = Extract<ChatItem, { kind: "message" }>;
type StepsItem = Extract<ChatItem, { kind: "steps" }>;

/** Narration longer than this is real content and stays visible. */
const MAX_FOLDED_NARRATION_CHARS = 400;
const STRUCTURED_TEXT = /^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|```|\|)/m;
const MEDIA_BLOCK_TYPES = new Set([
  "image",
  "image_url",
  "input_image",
  "audio",
  "input_audio",
  "video",
  "file",
  "attachment",
  "canvas",
]);

function roleOf(item: MessageItem): string {
  try {
    return normalizeRoleForGrouping(normalizeMessage(item.message).role).toLowerCase();
  } catch {
    return "";
  }
}

function hasMedia(message: unknown): boolean {
  if (!message || typeof message !== "object") {
    return false;
  }
  const m = message as Record<string, unknown>;
  for (const field of ["attachments", "images", "MediaPaths", "MediaPath", "mediaPaths"]) {
    const value = m[field];
    if (Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim()) {
      return true;
    }
  }
  return (
    Array.isArray(m.content) &&
    m.content.some((block) => {
      const type = (block as { type?: unknown } | null)?.type;
      return typeof type === "string" && MEDIA_BLOCK_TYPES.has(type.toLowerCase());
    })
  );
}

/** A `MEDIA:` line the assistant wrote to show a file it made. */
const MEDIA_LINE = /(?:^|\n)[ \t]*MEDIA:\s*\S/;

/** The message shows a picture or other media, as a block or a `MEDIA:` line. */
function showsMedia(message: unknown): boolean {
  return hasMedia(message) || MEDIA_LINE.test(extractTextCached(message) ?? "");
}

const TOOL_CALL_BLOCK_TYPES = new Set(["toolcall", "tool_call", "tooluse", "tool_use"]);

/**
 * The words and media of a step message without its tool call, so what it made
 * stays in the reply while the call itself folds into the steps.
 */
function withoutToolCalls(item: MessageItem): MessageItem | null {
  const message = item.message as Record<string, unknown> | null;
  if (!message || !Array.isArray(message.content)) {
    return null;
  }
  const content = message.content.filter((block) => {
    const type = (block as { type?: unknown } | null)?.type;
    return !(typeof type === "string" && TOOL_CALL_BLOCK_TYPES.has(type.toLowerCase()));
  });
  if (content.length === 0 || content.length === message.content.length) {
    return null;
  }
  const { foldOnly: _foldOnly, ...rest } = item;
  return { ...rest, key: `${item.key}:shown`, message: { ...message, content } };
}

/** Short, plain narration between tool calls — the "Let me check…" kind. */
function isFoldableNarration(message: unknown): boolean {
  const text = (extractTextCached(message) ?? "").trim();
  return text.length <= MAX_FOLDED_NARRATION_CHARS && !STRUCTURED_TEXT.test(text);
}

function toolCallNames(message: unknown, key: string): string[] {
  return extractToolCardsCached(message, key)
    .filter((card) => card.args !== undefined || card.inputText !== undefined)
    .map((card) => card.name);
}

function toolResultNames(message: unknown, key: string): string[] {
  return extractToolCardsCached(message, key)
    .filter((card) => card.args === undefined && card.inputText === undefined)
    .map((card) => card.name);
}

type Phrase = (count: number) => string;

const times = (count: number) => (count === 2 ? "twice" : `${count} times`);
const plural = (count: number, one: string, many: string) =>
  count === 1 ? one : many.replace("{n}", String(count));

/** What each tool did, in the past tense a person would use. */
const TOOL_PHRASES: Record<string, Phrase> = {
  web_search: (n) => (n === 1 ? "Searched the web" : `Searched the web ${times(n)}`),
  web_fetch: (n) => plural(n, "Read a web page", "Read {n} web pages"),
  exec: (n) => plural(n, "Ran a command", "Ran {n} commands"),
  bash: (n) => plural(n, "Ran a command", "Ran {n} commands"),
  process: (n) => plural(n, "Ran a command", "Ran {n} commands"),
  read: (n) => plural(n, "Read a file", "Read {n} files"),
  write: (n) => plural(n, "Wrote a file", "Wrote {n} files"),
  edit: (n) => plural(n, "Edited a file", "Edited {n} files"),
  apply_patch: (n) => plural(n, "Edited a file", "Edited {n} files"),
  image_generate: (n) => plural(n, "Made an image", "Made {n} images"),
  music_generate: (n) => plural(n, "Made a song", "Made {n} songs"),
  video_generate: (n) => plural(n, "Made a video", "Made {n} videos"),
  image: (n) => plural(n, "Looked at an image", "Looked at {n} images"),
  pdf: (n) => plural(n, "Read a PDF", "Read {n} PDFs"),
  tts: (n) => plural(n, "Made a voice note", "Made {n} voice notes"),
  cron: (n) => (n === 1 ? "Scheduled a task" : `Updated the schedule ${times(n)}`),
  reminder: (n) => plural(n, "Set a reminder", "Set {n} reminders"),
  message: (n) => plural(n, "Sent a message", "Sent {n} messages"),
  message_actions: (n) => plural(n, "Sent a message", "Sent {n} messages"),
  memory_query: () => "Checked memory",
  memory_search: () => "Checked memory",
  memory_get: () => "Checked memory",
  browser: () => "Used the browser",
  canvas: () => "Drew on the canvas",
  nodes: () => "Used your devices",
  sessions_spawn: (n) => plural(n, "Asked a helper", "Asked {n} helpers"),
  subagents: () => "Worked with helpers",
  update_plan: () => "Planned the steps",
};

function phraseFor(name: string, count: number): string {
  const key = name.trim().toLowerCase();
  const known = TOOL_PHRASES[key];
  if (known) {
    return known(count);
  }
  const skill = /^skills?[:_-](.+)$/.exec(key)?.[1];
  const label = (skill ?? key).replace(/[-_]+/g, " ").trim() || "a tool";
  return `Used ${label}${count > 1 ? ` ×${count}` : ""}`;
}

/** "Searched the web twice · Read a web page", at most three phrases. */
export function summarizeToolUse(names: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) {
    const phraseKey = phraseFor(name, 1);
    // Tools that read the same ("exec" and "bash") count together.
    counts.set(phraseKey, (counts.get(phraseKey) ?? 0) + 1);
  }
  const firstNameByPhrase = new Map<string, string>();
  for (const name of names) {
    const phraseKey = phraseFor(name, 1);
    if (!firstNameByPhrase.has(phraseKey)) {
      firstNameByPhrase.set(phraseKey, name);
    }
  }
  const phrases = [...counts.entries()].map(([phraseKey, count]) =>
    phraseFor(firstNameByPhrase.get(phraseKey) ?? phraseKey, count),
  );
  if (phrases.length === 0) {
    return "Show the steps";
  }
  const shown = phrases.slice(0, 3);
  const more = phrases.length - shown.length;
  return more > 0 ? `${shown.join(" · ")} · ${more} more` : shown.join(" · ");
}

export type FoldTurnStepsOptions = {
  /** A reply is still being worked on: its turn is left unfolded. */
  liveRunOpen: boolean;
  group: (items: ChatItem[]) => Array<ChatItem | MessageGroup>;
};

/**
 * Folds the steps of every finished reply. Items between two of the user's
 * messages are one turn; its last assistant message is the answer.
 */
export function foldCompletedTurnSteps(
  items: readonly ChatItem[],
  options: FoldTurnStepsOptions,
): ChatItem[] {
  const userIndexes: number[] = [];
  items.forEach((item, index) => {
    if (item.kind === "message" && roleOf(item) === "user") {
      userIndexes.push(index);
    }
  });
  if (userIndexes.length === 0) {
    return [...items];
  }
  const result: ChatItem[] = items.slice(0, userIndexes[0] + 1);
  for (let turn = 0; turn < userIndexes.length; turn++) {
    const start = userIndexes[turn] + 1;
    const end = turn + 1 < userIndexes.length ? userIndexes[turn + 1] : items.length;
    const segment = items.slice(start, end);
    const isLastTurn = turn === userIndexes.length - 1;
    result.push(...(isLastTurn && options.liveRunOpen ? segment : foldTurn(segment, options)));
    if (turn + 1 < userIndexes.length) {
      result.push(items[userIndexes[turn + 1]]);
    }
  }
  return result;
}

function foldTurn(segment: ChatItem[], options: FoldTurnStepsOptions): ChatItem[] {
  let answerIndex = -1;
  for (let i = segment.length - 1; i >= 0; i--) {
    const item = segment[i];
    if (item.kind === "message" && roleOf(item) === "assistant" && !item.foldOnly) {
      answerIndex = i;
      break;
    }
  }
  if (answerIndex <= 0) {
    return segment;
  }

  const steps: MessageItem[] = [];
  const kept: ChatItem[] = [];
  const shown: MessageItem[] = [];
  const toolNames: string[] = [];
  const resultNames: string[] = [];
  for (let i = 0; i < answerIndex; i++) {
    const item = segment[i];
    if (item.kind !== "message") {
      kept.push(item);
      continue;
    }
    // Grouping files assistant messages that call a tool under "tool", with
    // the tool results; plain assistant text stays "assistant".
    const role = roleOf(item);
    if (item.foldOnly === true || role === "tool") {
      steps.push(item);
      toolNames.push(...toolCallNames(item.message, item.key));
      resultNames.push(...toolResultNames(item.message, item.key));
      const madeSomething = showsMedia(item.message) ? withoutToolCalls(item) : null;
      if (madeSomething) {
        shown.push(madeSomething);
      }
      continue;
    }
    if (role === "assistant" && !hasMedia(item.message) && isFoldableNarration(item.message)) {
      steps.push(item);
      continue;
    }
    kept.push(item);
  }
  // The answer's own tool calls count too (a reply that ends on a tool step).
  const answer = segment[answerIndex] as MessageItem;
  toolNames.push(...toolCallNames(answer.message, answer.key));

  const usedTools = toolNames.length > 0 || resultNames.length > 0;
  if (steps.length === 0 || !usedTools) {
    return segment;
  }
  const stepsItem: StepsItem = {
    kind: "steps",
    key: `steps:${answer.key}`,
    summary: summarizeToolUse(toolNames.length > 0 ? toolNames : resultNames),
    groups: options
      .group(steps.map(({ foldOnly: _foldOnly, ...item }) => item))
      .filter((entry): entry is MessageGroup => entry.kind === "group"),
    timestamp: normalizeMessage(answer.message).timestamp || Date.now(),
  };
  return [...kept, stepsItem, ...shown, ...segment.slice(answerIndex)];
}
