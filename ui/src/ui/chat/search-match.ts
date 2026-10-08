// Control UI chat module implements search match behavior.
import { normalizeLowercaseStringOrEmpty } from "../string-coerce.ts";
import { extractTextCached } from "./message-extract.ts";

function foldSearchText(text: string): string {
  return normalizeLowercaseStringOrEmpty(text.normalize("NFKD").replace(/\p{M}+/gu, "")).replace(
    /\s+/g,
    " ",
  );
}

/**
 * Every word must appear, in any order; a "quoted phrase" stays together.
 * This is the same rule the gateway's chat.search uses, so a search result
 * opened in its chat is still found by the chat's own find bar.
 */
export function parseSearchTerms(query: string): string[] {
  const terms: string[] = [];
  for (const match of query.matchAll(/"([^"]+)"|(\S+)/g)) {
    const term = foldSearchText(match[1] ?? match[2] ?? "").trim();
    if (term && !terms.includes(term)) {
      terms.push(term);
    }
  }
  return terms;
}

export function textMatchesSearchQuery(text: string | null | undefined, query: string): boolean {
  const terms = parseSearchTerms(query);
  if (terms.length === 0) {
    return true;
  }
  const haystack = foldSearchText(text ?? "");
  return terms.every((term) => haystack.includes(term));
}

export function messageMatchesSearchQuery(message: unknown, query: string): boolean {
  return textMatchesSearchQuery(extractTextCached(message), query);
}
