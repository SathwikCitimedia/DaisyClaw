// Control UI module implements session display behavior.
import { normalizeLowercaseStringOrEmpty, normalizeOptionalString } from "./string-coerce.ts";
import type { SessionsListResult } from "./types.ts";

const CHANNEL_LABELS: Record<string, string> = {
  imessage: "iMessage",
  telegram: "Telegram",
  discord: "Discord",
  signal: "Signal",
  slack: "Slack",
  whatsapp: "WhatsApp",
  matrix: "Matrix",
  email: "Email",
  sms: "SMS",
};

const KNOWN_CHANNEL_KEYS = Object.keys(CHANNEL_LABELS);

/** Parsed type / context extracted from a session key. */
export type SessionKeyInfo = {
  /** Prefix for typed sessions (Subagent:/Cron:). Empty for others. */
  prefix: string;
  /** Human-readable fallback when no label / displayName is available. */
  fallbackName: string;
  /** Channel id for channel-bound sessions (whatsapp, telegram, …). */
  channel?: string;
  /** Peer/sender id for direct-chat sessions — used for contact-name lookup. */
  peerId?: string;
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Contact names saved in channel config (channels.<id>.contactLabels), keyed
 * by channel then sender id. Populated whenever a config snapshot loads so
 * session lists can show "Abhinash" instead of "+916305865365".
 */
let contactNamesByChannel: Record<string, Record<string, string>> = {};

/** Digits-only form used to match ids like "+91 93812 41869" vs "919381241869@s.whatsapp.net". */
function digitsOf(id: string): string {
  return id.replace(/@.*$/, "").replace(/\D/g, "");
}

/** Rebuild the contact-name lookup from a loaded config object. */
export function setSessionContactNames(config: Record<string, unknown> | null | undefined) {
  const next: Record<string, Record<string, string>> = {};
  const channels = config?.channels;
  if (channels && typeof channels === "object" && !Array.isArray(channels)) {
    for (const [channelId, channelConfig] of Object.entries(channels as Record<string, unknown>)) {
      const labels =
        channelConfig && typeof channelConfig === "object" && !Array.isArray(channelConfig)
          ? (channelConfig as Record<string, unknown>).contactLabels
          : undefined;
      if (!labels || typeof labels !== "object" || Array.isArray(labels)) {
        continue;
      }
      const byPeer: Record<string, string> = {};
      for (const [peer, name] of Object.entries(labels as Record<string, unknown>)) {
        if (typeof name !== "string" || !name.trim()) {
          continue;
        }
        byPeer[peer] = name.trim();
        const digits = digitsOf(peer);
        if (digits.length >= 6) {
          byPeer[digits] = name.trim();
        }
      }
      if (Object.keys(byPeer).length > 0) {
        next[channelId] = byPeer;
      }
    }
  }
  contactNamesByChannel = next;
}

/** Look up a saved contact name for a channel peer, tolerating format drift. */
export function lookupSessionContactName(
  channel: string | undefined,
  peerId: string | undefined,
): string | undefined {
  if (!channel || !peerId) {
    return undefined;
  }
  const byPeer = contactNamesByChannel[channel];
  if (!byPeer) {
    return undefined;
  }
  if (byPeer[peerId]) {
    return byPeer[peerId];
  }
  const digits = digitsOf(peerId);
  return digits.length >= 6 ? byPeer[digits] : undefined;
}

/**
 * Parse a session key to extract type information and a human-readable
 * fallback display name. Exported for testing.
 */
export function parseSessionKey(key: string): SessionKeyInfo {
  const normalized = normalizeLowercaseStringOrEmpty(key);

  // Main session.
  if (key === "main" || key === "agent:main:main") {
    return { prefix: "", fallbackName: "Main Session" };
  }

  // Subagent.
  if (key.includes(":subagent:")) {
    return { prefix: "Subagent:", fallbackName: "Subagent:" };
  }

  // Cron job.
  if (normalized.startsWith("cron:") || key.includes(":cron:")) {
    return { prefix: "Cron:", fallbackName: "Cron Job:" };
  }

  // Dashboard/webchat sessions without a saved title: show a human fallback
  // instead of the raw UUID key. Matches both the bare form ("dashboard:<id>")
  // and the agent-scoped form ("agent:<id>:dashboard:<id>") the control UI
  // actually creates — otherwise these fall through and render the raw key.
  if (
    normalized.startsWith("dashboard:") ||
    normalized.startsWith("webchat:") ||
    /^agent:[^:]+:(?:dashboard|webchat):/.test(normalized)
  ) {
    // An untitled dashboard chat is either brand-new or was never sent to, so
    // "New chat" reads better than naming the surface it came from.
    return { prefix: "", fallbackName: "New chat" };
  }

  // Direct chat: agent:<x>:<channel>:direct:<id>.
  const directMatch = key.match(/^agent:[^:]+:([^:]+):direct:(.+)$/);
  if (directMatch) {
    const channel = directMatch[1];
    const identifier = directMatch[2];
    const channelLabel = CHANNEL_LABELS[channel] ?? capitalize(channel);
    return {
      prefix: "",
      fallbackName: `${channelLabel} · ${identifier}`,
      channel,
      peerId: identifier,
    };
  }

  // Group chat: agent:<x>:<channel>:group:<id>.
  const groupMatch = key.match(/^agent:[^:]+:([^:]+):group:(.+)$/);
  if (groupMatch) {
    const channel = groupMatch[1];
    const channelLabel = CHANNEL_LABELS[channel] ?? capitalize(channel);
    return { prefix: "", fallbackName: `${channelLabel} Group` };
  }

  // Channel-prefixed legacy keys, for example "imessage:g-..." or "whatsapp:+91...".
  for (const ch of KNOWN_CHANNEL_KEYS) {
    if (key === ch || key.startsWith(`${ch}:`)) {
      const rest = key.slice(ch.length + 1);
      return {
        prefix: "",
        fallbackName: `${CHANNEL_LABELS[ch]} Session`,
        channel: ch,
        ...(rest ? { peerId: rest } : {}),
      };
    }
  }

  // Unknown: return key as-is.
  return { prefix: "", fallbackName: key };
}

export function resolveSessionDisplayName(
  key: string,
  row?: SessionsListResult["sessions"][number],
): string {
  const label = normalizeOptionalString(row?.label) ?? "";
  const displayName = normalizeOptionalString(row?.displayName) ?? "";
  const { prefix, fallbackName, channel, peerId } = parseSessionKey(key);

  const applyTypedPrefix = (name: string): string => {
    if (!prefix) {
      return name;
    }
    const prefixPattern = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s*`, "i");
    return prefixPattern.test(name) ? name : `${prefix} ${name}`;
  };

  // A saved contact name beats a raw sender-id title, but never a title the
  // user (or auto-titling) chose deliberately.
  const contactName = lookupSessionContactName(channel, peerId);
  const isRawIdentifier = (value: string): boolean => {
    if (!value || value === key || value === peerId) {
      return true;
    }
    if (!peerId) {
      return false;
    }
    const valueDigits = digitsOf(value);
    const peerDigits = digitsOf(peerId);
    return valueDigits.length >= 6 && valueDigits === peerDigits;
  };

  if (label && label !== key && !(contactName && isRawIdentifier(label))) {
    return applyTypedPrefix(label);
  }
  if (displayName && displayName !== key && !(contactName && isRawIdentifier(displayName))) {
    return applyTypedPrefix(displayName);
  }
  if (contactName) {
    return contactName;
  }
  return fallbackName;
}

export function isCronSessionKey(key: string): boolean {
  const normalized = normalizeLowercaseStringOrEmpty(key);
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("cron:")) {
    return true;
  }
  if (!normalized.startsWith("agent:")) {
    return false;
  }
  const parts = normalized.split(":").filter(Boolean);
  if (parts.length < 3) {
    return false;
  }
  const rest = parts.slice(2).join(":");
  return rest.startsWith("cron:");
}
