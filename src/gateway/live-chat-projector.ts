// Gateway live chat projector.
// Converts streaming assistant events into display-safe live chat text.
import { stripInternalRuntimeContext } from "../agents/internal-runtime-context.js";
import {
  SILENT_REPLY_TOKEN,
  startsWithSilentToken,
  stripLeadingSilentToken,
} from "../auto-reply/tokens.js";
import { resolveAssistantEventPhase } from "../shared/chat-message-content.js";
import { stripInlineDirectiveTagsForDisplay } from "../utils/directive-tags.js";
import {
  isSuppressedControlReplyLeadFragment,
  isSuppressedControlReplyText,
} from "./control-reply-text.js";

export const MAX_LIVE_CHAT_BUFFER_CHARS = 500_000;

function capLiveAssistantBuffer(text: string): string {
  if (text.length <= MAX_LIVE_CHAT_BUFFER_CHARS) {
    return text;
  }
  return text.slice(-MAX_LIVE_CHAT_BUFFER_CHARS);
}

/** The image and media paths an assistant event carries, in order. */
export function collectLiveAssistantMediaUrls(data: {
  mediaUrls?: unknown;
  mediaUrl?: unknown;
}): string[] {
  const urls = [
    ...(Array.isArray(data.mediaUrls) ? data.mediaUrls : []),
    ...(typeof data.mediaUrl === "string" ? [data.mediaUrl] : []),
  ]
    .filter((url): url is string => typeof url === "string")
    .map((url) => url.trim())
    .filter(Boolean);
  return [...new Set(urls)];
}

/**
 * Puts the media a live reply has produced back into its text, as the
 * `MEDIA:` lines the model wrote. Live events carry text with those lines
 * taken out and the paths alongside, so without this an image the assistant
 * made only appeared once the reply finished and the page reloaded. A line is
 * added where the image first turned up, so it stays with the words around
 * it, and re-added at the end if a rewrite of the text dropped it.
 */
export function withLiveAssistantMedia(text: string, mediaUrls: readonly string[]): string {
  let next = text;
  for (const url of mediaUrls) {
    const line = `MEDIA:${url}`;
    if (!next.includes(line)) {
      next = next ? `${next.replace(/\s+$/, "")}\n\n${line}\n\n` : `${line}\n\n`;
    }
  }
  return next;
}

/** Merges assistant full-text and delta events into a capped live buffer. */
export function resolveMergedAssistantText(params: {
  previousText: string;
  nextText: string;
  nextDelta: string;
}): string {
  const { previousText, nextText, nextDelta } = params;
  if (nextText && previousText) {
    if (nextText.startsWith(previousText) && nextText.length > previousText.length) {
      return capLiveAssistantBuffer(nextText);
    }
    if (previousText.startsWith(nextText) && !nextDelta) {
      return capLiveAssistantBuffer(previousText);
    }
  }
  if (nextDelta) {
    return capLiveAssistantBuffer(previousText + nextDelta);
  }
  if (nextText) {
    return capLiveAssistantBuffer(nextText);
  }
  return capLiveAssistantBuffer(previousText);
}

/** Removes runtime-only context/directive tags from live assistant event text. */
export function normalizeLiveAssistantEventText(params: { text: string; delta?: unknown }): {
  text: string;
  delta: string;
} {
  return {
    text: stripInternalRuntimeContext(stripInlineDirectiveTagsForDisplay(params.text).text),
    delta:
      typeof params.delta === "string"
        ? stripInternalRuntimeContext(stripInlineDirectiveTagsForDisplay(params.delta).text)
        : "",
  };
}

/** Projects buffered assistant text into display text or a suppressed/pending state. */
export function projectLiveAssistantBufferedText(
  rawText: string,
  options?: { suppressLeadFragments?: boolean },
): {
  text: string;
  suppress: boolean;
  pendingLeadFragment: boolean;
} {
  if (!rawText) {
    return { text: "", suppress: true, pendingLeadFragment: false };
  }
  if (isSuppressedControlReplyText(rawText)) {
    return { text: "", suppress: true, pendingLeadFragment: false };
  }
  if (options?.suppressLeadFragments !== false && isSuppressedControlReplyLeadFragment(rawText)) {
    return { text: rawText, suppress: true, pendingLeadFragment: true };
  }
  const text = startsWithSilentToken(rawText, SILENT_REPLY_TOKEN)
    ? stripLeadingSilentToken(rawText, SILENT_REPLY_TOKEN)
    : rawText;
  if (!text || isSuppressedControlReplyText(text)) {
    return { text: "", suppress: true, pendingLeadFragment: false };
  }
  if (options?.suppressLeadFragments !== false && isSuppressedControlReplyLeadFragment(text)) {
    return { text, suppress: true, pendingLeadFragment: true };
  }
  return { text, suppress: false, pendingLeadFragment: false };
}

/** Returns true when an assistant event phase should not appear in live chat. */
export function shouldSuppressAssistantEventForLiveChat(data: unknown): boolean {
  return resolveAssistantEventPhase(data) === "commentary";
}
