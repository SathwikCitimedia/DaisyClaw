// Reset helpers classify session keys and route reset config by session/channel type.
import {
  normalizeLowercaseStringOrEmpty,
  normalizeOptionalLowercaseString,
} from "@daisyclaw/normalization-core/string-coerce";
import { resolveLoadedSessionThreadInfo } from "../../channels/plugins/session-thread-info-loaded.js";
import { normalizeMessageChannel } from "../../utils/message-channel.js";
import type { SessionConfig, SessionResetConfig } from "../types.base.js";
/** Public reset policy exports plus helpers that classify direct, group, and thread sessions. */
export {
  DEFAULT_RESET_AT_HOUR,
  DEFAULT_RESET_MODE,
  evaluateSessionFreshness,
  resolveDailyResetAtMs,
  resolveSessionResetPolicy,
  type SessionFreshness,
  type SessionResetMode,
  type SessionResetPolicy,
  type SessionResetType,
} from "./reset-policy.js";
import type { SessionResetType } from "./reset-policy.js";

const GROUP_SESSION_MARKERS = [":group:", ":channel:"];

/** Returns true when a session key is known to represent a thread. */
export function isThreadSessionKey(sessionKey?: string | null): boolean {
  return Boolean(resolveLoadedSessionThreadInfo(sessionKey).threadId);
}

export function resolveSessionResetType(params: {
  sessionKey?: string | null;
  isGroup?: boolean;
  isThread?: boolean;
}): SessionResetType {
  // Thread wins over group because thread-specific reset policy should apply to grouped replies.
  if (params.isThread || isThreadSessionKey(params.sessionKey)) {
    return "thread";
  }
  if (params.isGroup) {
    return "group";
  }
  const normalized = normalizeLowercaseStringOrEmpty(params.sessionKey);
  if (GROUP_SESSION_MARKERS.some((marker) => normalized.includes(marker))) {
    return "group";
  }
  return "direct";
}

export function resolveThreadFlag(params: {
  sessionKey?: string | null;
  messageThreadId?: string | number | null;
  threadLabel?: string | null;
  threadStarterBody?: string | null;
  parentSessionKey?: string | null;
}): boolean {
  if (params.messageThreadId != null) {
    return true;
  }
  if (params.threadLabel?.trim()) {
    return true;
  }
  if (params.threadStarterBody?.trim()) {
    return true;
  }
  if (params.parentSessionKey?.trim()) {
    return true;
  }
  return isThreadSessionKey(params.sessionKey);
}

/**
 * The desktop app's own chat window behaves like a messaging app, not like a
 * channel. A daily reset is right for WhatsApp, where each day is a new
 * conversation, but in the dashboard it meant the user said goodnight and found
 * an assistant the next morning that had started over. They kept their history
 * on screen and lost the thread of it, which reads as being forgotten.
 *
 * So the built-in chat defaults to picking up where it left off, and only
 * starts fresh after several quiet days. Anything the user or an operator
 * configures for this channel still wins.
 */
const DASHBOARD_CHAT_CHANNEL = "webchat";
const DASHBOARD_CHAT_IDLE_MINUTES = 5 * 24 * 60;

const DEFAULT_CHANNEL_RESETS: Readonly<Record<string, SessionResetConfig>> = {
  [DASHBOARD_CHAT_CHANNEL]: { mode: "idle", idleMinutes: DASHBOARD_CHAT_IDLE_MINUTES },
};

export function resolveChannelResetConfig(params: {
  sessionCfg?: SessionConfig;
  channel?: string | null;
}): SessionResetConfig | undefined {
  const normalized = normalizeMessageChannel(params.channel);
  const fallback = normalizeOptionalLowercaseString(params.channel);
  // Channel ids can arrive as public message-channel names or raw provider keys.
  const key = normalized ?? fallback;
  if (!key) {
    return undefined;
  }
  const configured = params.sessionCfg?.resetByChannel?.[key];
  if (configured) {
    return configured;
  }
  return DEFAULT_CHANNEL_RESETS[key];
}
