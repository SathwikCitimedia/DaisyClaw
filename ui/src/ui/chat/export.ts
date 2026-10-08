// Control UI chat module implements export behavior.
import { timestampMsToIsoString } from "@daisyclaw/normalization-core/number-coercion";
import { extractTextCached } from "./message-extract.ts";

export type ExportChatOptions = {
  /** The chat's name; used as the heading and the file name. */
  title?: string;
  now?: Date;
};

/**
 * Export chat history as markdown file. Returns false when there was nothing
 * worth saving, so callers can say so instead of silently doing nothing.
 */
export function exportChatMarkdown(
  messages: unknown[],
  assistantName: string,
  opts: ExportChatOptions = {},
): boolean {
  const markdown = buildChatMarkdown(messages, assistantName, { title: opts.title });
  if (!markdown) {
    return false;
  }
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildChatExportFileName(
    opts.title ?? `chat-${assistantName}`,
    opts.now ?? new Date(),
  );
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking in the same tick can cancel the download in embedded webviews.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return true;
}

/** "Trip to Goa" on 5 Mar 2026 becomes "trip-to-goa-2026-03-05.md". */
export function buildChatExportFileName(title: string, now: Date): string {
  const slug =
    title
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "chat";
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `${slug}-${date}.md`;
}

export function buildChatMarkdown(
  messages: unknown[],
  assistantName: string,
  opts: { title?: string } = {},
): string | null {
  const history = Array.isArray(messages) ? messages : [];
  const lines: string[] = [];
  for (const msg of history) {
    const m = msg as Record<string, unknown>;
    // Tool output is machine text; a saved conversation is the people talking.
    if (m.role !== "user" && m.role !== "assistant") {
      continue;
    }
    const content = (extractTextCached(msg) ?? "").trim();
    if (!content) {
      continue;
    }
    const role = m.role === "user" ? "You" : assistantName;
    const ts = timestampMsToIsoString(m.timestamp) ?? "";
    lines.push(`## ${role}${ts ? ` (${ts})` : ""}`, "", content, "");
  }
  if (lines.length === 0) {
    return null;
  }
  const title = opts.title?.trim();
  const header = title
    ? [`# ${title}`, "", `Chat with ${assistantName}`, ""]
    : [`# Chat with ${assistantName}`, ""];
  return [...header, ...lines].join("\n");
}
