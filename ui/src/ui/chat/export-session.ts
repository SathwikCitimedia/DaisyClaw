// Control UI chat module exports a whole chat, loaded fresh from the gateway.
//
// The open chat only holds the messages the user has scrolled through, and a
// chat in the sidebar holds none at all, so exporting reads the transcript
// again at the largest page the protocol allows.
import { shouldHideHistoryMessage } from "../controllers/chat.ts";
import { exportChatMarkdown } from "./export.ts";
import { CHAT_HISTORY_RENDER_LIMIT_MAX } from "./history-limits.ts";

type HistoryClient = {
  request<T = unknown>(method: string, params?: unknown): Promise<T>;
};

export type ExportSessionChatParams = {
  client: HistoryClient | null;
  sessionKey: string;
  agentId?: string;
  title?: string;
  assistantName: string;
  /** Replaced in tests; defaults to the browser download. */
  save?: typeof exportChatMarkdown;
};

export type ExportSessionChatResult =
  | { ok: true }
  | { ok: false; reason: "disconnected" | "empty" | "failed"; error?: string };

export async function exportSessionChat(
  params: ExportSessionChatParams,
): Promise<ExportSessionChatResult> {
  if (!params.client) {
    return { ok: false, reason: "disconnected" };
  }
  let messages: unknown[];
  try {
    const res = await params.client.request<{ messages?: unknown[] }>("chat.history", {
      sessionKey: params.sessionKey,
      ...(params.agentId ? { agentId: params.agentId } : {}),
      limit: CHAT_HISTORY_RENDER_LIMIT_MAX,
    });
    messages = Array.isArray(res?.messages) ? res.messages : [];
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err ?? "");
    return { ok: false, reason: "failed", error: error.replace(/^GatewayRequestError:\s*/i, "") };
  }
  const visible = messages.filter((message) => !shouldHideHistoryMessage(message));
  const save = params.save ?? exportChatMarkdown;
  return save(visible, params.assistantName, { title: params.title })
    ? { ok: true }
    : { ok: false, reason: "empty" };
}
