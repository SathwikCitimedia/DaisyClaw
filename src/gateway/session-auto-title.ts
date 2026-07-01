// Auto-titles control-surface chat sessions (dashboard / main) from the first
// user message, ChatGPT-style: an instant heuristic title is applied right away,
// then optionally refined by a short LLM completion. Channel/cron/subagent
// sessions are intentionally excluded — they derive names from their own context.

export const MAX_SESSION_TITLE_LENGTH = 48;

export const SESSION_TITLE_SYSTEM_PROMPT = [
  "You generate a very short title for a chat conversation based on the user's first message.",
  "Rules:",
  "- 3 to 6 words.",
  "- Use Title Case.",
  "- Summarize the topic or task, not greetings or pleasantries.",
  "- No surrounding quotes, no trailing punctuation, no emojis.",
  "Reply with ONLY the title text.",
].join("\n");

// Sessions that originate from external messaging channels, scheduled jobs, or
// nested agents already get meaningful names elsewhere and must not be retitled.
const CHANNEL_PREFIXES = [
  "imessage",
  "telegram",
  "discord",
  "signal",
  "slack",
  "whatsapp",
  "matrix",
  "email",
  "sms",
  "nostr",
  "msteams",
  "line",
  "feishu",
  "googlechat",
  "twitch",
  "zalo",
  "qqbot",
  "tlon",
];

/** True for dashboard / control-UI chat sessions that should be auto-titled. */
export function isAutoTitleEligibleSessionKey(key: string): boolean {
  const k = (key ?? "").trim().toLowerCase();
  if (!k) {
    return false;
  }
  // Typed sessions keep their structural names.
  if (k.startsWith("cron:") || k.includes(":cron:") || k.includes(":subagent:")) {
    return false;
  }
  if (k.includes(":acp") || k.includes(":acp:")) {
    return false;
  }
  // Channel direct/group conversations are named from channel context.
  if (k.includes(":direct:") || k.includes(":group:")) {
    return false;
  }
  for (const prefix of CHANNEL_PREFIXES) {
    if (k === prefix || k.startsWith(`${prefix}:`)) {
      return false;
    }
  }
  return true;
}

function clampToTitleLength(value: string): string {
  if (value.length <= MAX_SESSION_TITLE_LENGTH) {
    return value;
  }
  const cut = value.slice(0, MAX_SESSION_TITLE_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > 16 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trim()}…`;
}

/** Instant, no-LLM title derived from the first user message. */
export function buildHeuristicSessionTitle(message: string): string | null {
  if (typeof message !== "string") {
    return null;
  }
  let s = message
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/https?:\/\/\S+/g, " ") // urls
    .replace(/[#>*_~`[\]()]/g, " ") // markdown punctuation
    .replace(/\s+/g, " ")
    .trim();
  if (!s) {
    return null;
  }
  // Prefer the first sentence / line.
  const firstSegment = s.split(/[\n.!?]/)[0]?.trim();
  if (firstSegment && firstSegment.length >= 12) {
    s = firstSegment;
  }
  return clampToTitleLength(s);
}

/** Normalizes an LLM-produced title (strip quotes / trailing punctuation / length). */
export function sanitizeGeneratedTitle(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  let s = raw.replace(/\s+/g, " ").trim();
  s = s.replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, "").trim();
  s = s.replace(/[.!?,;:]+$/g, "").trim();
  if (!s) {
    return null;
  }
  if (s.length > MAX_SESSION_TITLE_LENGTH) {
    const cut = s.slice(0, MAX_SESSION_TITLE_LENGTH);
    const lastSpace = cut.lastIndexOf(" ");
    s = (lastSpace > 16 ? cut.slice(0, lastSpace) : cut).trim();
  }
  return s || null;
}

export type MaybeAutoTitleSessionParams = {
  sessionKey: string;
  /** Existing user/auto label on the session, if any (skips when present). */
  existingLabel?: string | null;
  /** Existing display name on the session, if any (skips when present). */
  existingDisplayName?: string | null;
  /**
   * Number of user/assistant messages already in the session BEFORE this send.
   * Auto-titling is a "first message" behavior: when the session already has
   * prior conversation (> 0), it must not be retitled — otherwise reopening an
   * old, never-titled session and continuing it would rename it from the latest
   * message. Omit/leave null only for genuinely new sessions.
   */
  priorMessageCount?: number | null;
  message: string;
  /** Persists a label onto the session. */
  applyLabel: (label: string) => Promise<unknown>;
  /** Optional LLM refinement; omit to use the heuristic title only. */
  generateLabel?: (userMessage: string) => Promise<string | null>;
  onError?: (err: unknown) => void;
};

/**
 * Applies an instant heuristic title, then (best-effort) refines it via the
 * provided generator. Safe to call fire-and-forget on every send: it no-ops
 * unless the session is eligible and has no title yet.
 */
export async function maybeAutoTitleSession(params: MaybeAutoTitleSessionParams): Promise<void> {
  const { sessionKey, existingLabel, existingDisplayName, priorMessageCount, message } = params;
  if (!isAutoTitleEligibleSessionKey(sessionKey)) {
    return;
  }
  if ((existingLabel ?? "").trim() || (existingDisplayName ?? "").trim()) {
    return;
  }
  // Only title brand-new sessions, on their first message. A session that
  // already has prior conversation must keep its name even if it was never
  // titled (e.g. created before auto-titling existed).
  if (typeof priorMessageCount === "number" && priorMessageCount > 0) {
    return;
  }
  const heuristic = buildHeuristicSessionTitle(message);

  // ChatGPT/Claude-style: prefer a proper model-generated title and NEVER surface
  // the user's raw first message as the session name. The raw-message heuristic is
  // used only as a fallback when no generator is configured or the model call
  // fails — so the session stays on its default name briefly while the title is
  // generated, then flips to a clean Title-Case topic.
  if (params.generateLabel) {
    try {
      const refined = sanitizeGeneratedTitle(await params.generateLabel(message));
      if (refined) {
        await params.applyLabel(refined);
        return;
      }
    } catch (err) {
      params.onError?.(err);
    }
  }

  // Fallback path: no LLM generator, or generation failed/returned nothing.
  if (heuristic) {
    try {
      await params.applyLabel(heuristic);
    } catch (err) {
      params.onError?.(err);
    }
  }
}
