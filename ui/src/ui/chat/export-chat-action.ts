// Control UI chat module runs "Export chat" from any menu and tells the user how it went.
import { t } from "../../i18n/index.ts";
import { scopedAgentParamsForSession } from "../app-chat.ts";
import type { AppViewState } from "../app-view-state.ts";
import { resolveSessionDisplayName } from "../session-display.ts";
import { showToast } from "../toast.ts";
import { exportSessionChat } from "./export-session.ts";

type ExportChatHost = Pick<
  AppViewState,
  | "client"
  | "connected"
  | "sessionsResult"
  | "assistantName"
  | "assistantAgentId"
  | "agentsList"
  | "hello"
>;

export async function exportChatWithFeedback(host: ExportChatHost, sessionKey: string) {
  if (!host.client || !host.connected) {
    showToast(t("chat.export.disconnected"), { tone: "error" });
    return;
  }
  const row = host.sessionsResult?.sessions?.find((entry) => entry.key === sessionKey);
  const title = resolveSessionDisplayName(sessionKey, row);
  const result = await exportSessionChat({
    client: host.client,
    sessionKey,
    ...scopedAgentParamsForSession(host, sessionKey),
    title,
    assistantName: host.assistantName,
  });
  if (result.ok) {
    showToast(t("chat.export.done", { name: title }), { tone: "success" });
    return;
  }
  if (result.reason === "empty") {
    showToast(t("chat.export.empty"), { tone: "info" });
    return;
  }
  if (result.reason === "disconnected") {
    showToast(t("chat.export.disconnected"), { tone: "error" });
    return;
  }
  showToast(t("chat.export.failed", { error: result.error || t("chat.export.unknownError") }), {
    tone: "error",
  });
}
