// Control UI chat module decides when "Regenerate" can safely ask the last question again.
//
// Regenerating reuses the edit path: fork the session to just before the
// question, then send the same words. That is only safe when the reply is the
// latest one and answers the latest question (redoing an older answer would
// drop everything said after it), and when the question is plain text: the
// resend carries words only, so a question with a photo or file would come
// back without it.
import type { ChatItem, MessageGroup } from "../types/chat-types.ts";

export type RegenerateTurn = {
  userGroup: MessageGroup;
  userIndex: number;
  text: string;
};

const ATTACHMENT_TEXT_MARKERS = [/^\s*attached (image|file)\b/im, /\[media attached/i];

function messageHasAttachment(message: unknown): boolean {
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
  const content = m.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const type = (part as { type?: unknown } | null)?.type;
      if (type !== "text") {
        return true;
      }
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string" && ATTACHMENT_TEXT_MARKERS.some((marker) => marker.test(text))) {
        return true;
      }
    }
    return false;
  }
  return (
    typeof content === "string" && ATTACHMENT_TEXT_MARKERS.some((marker) => marker.test(content))
  );
}

function isGroup(item: ChatItem | MessageGroup): item is MessageGroup {
  return item.kind === "group";
}

function isRole(item: MessageGroup, role: string): boolean {
  return String(item.role).toLowerCase() === role;
}

export function resolveRegenerateTurn(
  items: ReadonlyArray<ChatItem | MessageGroup>,
  latestAssistantKey: string | undefined,
  readText: (group: MessageGroup) => string,
): RegenerateTurn | null {
  if (!latestAssistantKey) {
    return null;
  }
  const assistantIndex = items.findIndex((item) => item.key === latestAssistantKey);
  if (assistantIndex < 0) {
    return null;
  }
  // A question after this reply is still waiting for its answer.
  for (let i = assistantIndex + 1; i < items.length; i++) {
    const item = items[i];
    if (isGroup(item) && isRole(item, "user")) {
      return null;
    }
  }
  for (let i = assistantIndex - 1; i >= 0; i--) {
    const item = items[i];
    if (!isGroup(item) || !isRole(item, "user")) {
      continue;
    }
    if (item.messages.some((entry) => messageHasAttachment(entry.message))) {
      return null;
    }
    const text = readText(item).trim();
    // A slash command is an instruction to the app, not a question to answer again.
    if (!text || text.startsWith("/")) {
      return null;
    }
    return { userGroup: item, userIndex: i, text };
  }
  return null;
}
