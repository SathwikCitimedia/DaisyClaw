// One-shot repair for control-UI chats that never received a title (they show
// as "Dashboard <uuid>" in the sidebar). Titles used to wait on a model call, so
// a slow provider or a gateway restart could leave a chat unnamed for good.
// This derives the same instant heuristic title from the transcript's first
// user message — no model, no network.
import path from "node:path";
import { listAgentIds } from "../agents/agent-scope.js";
import {
  listSessionEntries,
  resolveSessionFilePath,
  resolveStorePath,
} from "../config/sessions.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { applyAutoSessionLabel } from "./server-methods/session-label-apply.js";
import { buildHeuristicSessionTitle, isAutoTitleEligibleSessionKey } from "./session-auto-title.js";
import { readSessionTranscriptIndex } from "./session-transcript-index.fs.js";

type TranscriptEntryLike = { record: Record<string, unknown> };

/** Only UUID-named control-UI chats are repaired; "main"/"global" keep their structural names. */
export function isRepairableUntitledSessionKey(key: string): boolean {
  const k = (key ?? "").trim().toLowerCase();
  return isAutoTitleEligibleSessionKey(k) && (k.includes("dashboard:") || k.includes("webchat:"));
}

/** First user message text in a transcript index, or null when none exists. */
export function extractFirstUserMessageText(
  entries: ReadonlyArray<TranscriptEntryLike>,
): string | null {
  for (const entry of entries) {
    const message = entry.record.message as { role?: unknown; content?: unknown } | undefined;
    if (!message || message.role !== "user") {
      continue;
    }
    const content = message.content;
    if (typeof content === "string") {
      const text = content.trim();
      if (text) {
        return text;
      }
      continue;
    }
    if (Array.isArray(content)) {
      const text = content
        .filter(
          (block): block is { type: "text"; text: string } =>
            Boolean(block) &&
            typeof block === "object" &&
            (block as { type?: unknown }).type === "text" &&
            typeof (block as { text?: unknown }).text === "string",
        )
        .map((block) => block.text)
        .join(" ")
        .trim();
      if (text) {
        return text;
      }
    }
  }
  return null;
}

export type UntitledSessionRepairResult = { scanned: number; repaired: number };

/** Titles every repairable untitled chat from its first user message. Best-effort per session. */
export async function repairUntitledControlSessions(params: {
  cfg: DaisyClawConfig;
  log?: { warn: (msg: string) => void };
}): Promise<UntitledSessionRepairResult> {
  const { cfg } = params;
  let scanned = 0;
  let repaired = 0;
  for (const agentId of listAgentIds(cfg)) {
    const storePath = resolveStorePath(cfg.session?.store, { agentId });
    let entries: ReturnType<typeof listSessionEntries>;
    try {
      entries = listSessionEntries({ agentId, storePath });
    } catch (err) {
      params.log?.warn(
        `session title repair: cannot read store for agent ${agentId}: ${String(err)}`,
      );
      continue;
    }
    for (const { sessionKey, entry } of entries) {
      if (!isRepairableUntitledSessionKey(sessionKey)) {
        continue;
      }
      if ((entry.label ?? "").trim() || (entry.displayName ?? "").trim()) {
        continue;
      }
      const sessionId = typeof entry.sessionId === "string" ? entry.sessionId.trim() : "";
      if (!sessionId) {
        continue;
      }
      scanned += 1;
      const sessionFile = (entry as { sessionFile?: string }).sessionFile;
      let transcriptPath: string;
      try {
        transcriptPath = resolveSessionFilePath(
          sessionId,
          sessionFile ? { sessionFile } : undefined,
          { sessionsDir: path.dirname(storePath), agentId },
        );
      } catch {
        continue;
      }
      const index = await readSessionTranscriptIndex(transcriptPath).catch(() => null);
      if (!index) {
        continue;
      }
      const firstMessage = extractFirstUserMessageText(index.entries);
      const title = firstMessage ? buildHeuristicSessionTitle(firstMessage) : null;
      if (!title) {
        continue;
      }
      if (await applyAutoSessionLabel({ cfg, key: sessionKey, agentId, label: title })) {
        repaired += 1;
      }
    }
  }
  return { scanned, repaired };
}
