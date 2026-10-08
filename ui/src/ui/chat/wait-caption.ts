// Explains a long wait for the first token instead of showing silent dots.
//
// A slow provider is indistinguishable from a frozen app when the only signal
// is an animated ellipsis. These captions age with the wait and name the
// provider being waited on, so the user can tell "my model is slow" apart from
// "Daisy is stuck" — and always sees a way to stop.

/** Caption thresholds. Under CONNECTING_MS the dots stay bare, so fast models show nothing. */
export const WAIT_CAPTION_CONNECTING_MS = 3_000;
export const WAIT_CAPTION_ELAPSED_MS = 8_000;
export const WAIT_CAPTION_STILL_MS = 25_000;
/** Beyond this the Stop control is emphasized so "stuck" always has an exit. */
export const WAIT_CAPTION_STOP_HINT_MS = 10_000;

export type WaitCaptionInput = {
  /** ms since the request was sent. */
  elapsedMs: number;
  /** Provider id for the active model, e.g. "anthropic" or "litellm". */
  provider?: string | null;
  /** Human label for the tool currently running, when the agent is using one. */
  activeToolLabel?: string | null;
};

export type WaitCaption = {
  text: string;
  /** True once the wait is long enough to emphasize Stop. */
  emphasizeStop: boolean;
};

function formatSeconds(elapsedMs: number): string {
  return `${Math.floor(elapsedMs / 1000)}s`;
}

/**
 * Caption for the current wait, or null while the wait is still short enough
 * that bare dots read as "instant".
 */
export function resolveWaitCaption(input: WaitCaptionInput): WaitCaption | null {
  const elapsedMs = Number.isFinite(input.elapsedMs) ? Math.max(0, input.elapsedMs) : 0;
  const emphasizeStop = elapsedMs >= WAIT_CAPTION_STOP_HINT_MS;

  // Tool work is concrete progress: name it immediately, no threshold.
  const tool = input.activeToolLabel?.trim();
  if (tool) {
    return { text: tool, emphasizeStop };
  }
  if (elapsedMs < WAIT_CAPTION_CONNECTING_MS) {
    return null;
  }
  const provider = input.provider?.trim();
  if (elapsedMs < WAIT_CAPTION_ELAPSED_MS) {
    return {
      text: provider ? `Connecting to ${provider}…` : "Connecting to your model…",
      emphasizeStop,
    };
  }
  const seconds = formatSeconds(elapsedMs);
  const still = elapsedMs >= WAIT_CAPTION_STILL_MS ? "Still waiting" : "Waiting";
  return {
    text: provider ? `${still} on ${provider} · ${seconds}` : `${still} for a reply · ${seconds}`,
    emphasizeStop,
  };
}

// Tool names are internal ids; only the ones worth narrating get a phrase.
const TOOL_LABELS: Record<string, string> = {
  bash: "Running a command…",
  exec: "Running a command…",
  read: "Reading a file…",
  write: "Writing a file…",
  edit: "Editing a file…",
  glob: "Looking through files…",
  grep: "Searching your files…",
  websearch: "Searching the web…",
  webfetch: "Reading a web page…",
  memory: "Checking memory…",
  memoryquery: "Checking memory…",
  memorysearch: "Checking memory…",
  memoryget: "Checking memory…",
  skill: "Using a skill…",
  process: "Running a command…",
  applypatch: "Editing a file…",
  imagegenerate: "Making an image…",
  musicgenerate: "Making music…",
  videogenerate: "Making a video…",
  image: "Looking at an image…",
  pdf: "Reading a PDF…",
  tts: "Making a voice note…",
  cron: "Updating the schedule…",
  reminder: "Setting a reminder…",
  message: "Sending a message…",
  messageactions: "Sending a message…",
  browser: "Using the browser…",
  canvas: "Drawing on the canvas…",
  sessionsspawn: "Asking a helper…",
  subagents: "Working with helpers…",
  updateplan: "Planning the steps…",
};

/**
 * Wait clocks per session. The elapsed time is measured from when the UI
 * started waiting rather than from a message timestamp, so it matches what the
 * user actually experiences.
 */
const waitStartedAt = new Map<string, number>();

type SessionsResultLike = {
  sessions?: ReadonlyArray<{ key?: string; modelProvider?: string | null }>;
  defaults?: { modelProvider?: string | null };
} | null;

/**
 * Provider id for the session's active model, used to name who is being waited
 * on. Falls back to the gateway defaults, then null (generic wording).
 */
export function resolveWaitProviderName(
  sessions: SessionsResultLike | undefined,
  sessionKey: string,
): string | null {
  const row = sessions?.sessions?.find((entry) => entry.key === sessionKey);
  const provider = row?.modelProvider ?? sessions?.defaults?.modelProvider ?? null;
  const trimmed = typeof provider === "string" ? provider.trim() : "";
  return trimmed || null;
}

/** Elapsed wait for a session, starting the clock on the first awaiting render. */
export function trackWaitElapsedMs(
  sessionKey: string,
  awaiting: boolean,
  now: number = Date.now(),
): number | null {
  if (!awaiting) {
    waitStartedAt.delete(sessionKey);
    return null;
  }
  const started = waitStartedAt.get(sessionKey);
  if (started === undefined) {
    waitStartedAt.set(sessionKey, now);
    return 0;
  }
  return Math.max(0, now - started);
}

/** Test/teardown hook: forgets all wait clocks. */
export function resetWaitClocks(): void {
  waitStartedAt.clear();
}

let tickTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Re-renders once a second while a caption is on screen so the counter moves.
 * Self-limiting: only the render path schedules it, and it stops as soon as the
 * wait ends.
 */
export function scheduleWaitCaptionTick(requestUpdate: () => void, delayMs = 1000): void {
  if (tickTimer) {
    return;
  }
  tickTimer = setTimeout(() => {
    tickTimer = undefined;
    requestUpdate();
  }, delayMs);
}

export function cancelWaitCaptionTick(): void {
  if (tickTimer) {
    clearTimeout(tickTimer);
    tickTimer = undefined;
  }
}

/**
 * Name of the most recent tool that has been invoked but has produced no
 * output yet, i.e. the one currently running. Returns null when the last tool
 * already reported a result (so a finished tool never keeps narrating).
 */
export function resolveRunningToolName(toolMessages: readonly unknown[]): string | null {
  for (let i = toolMessages.length - 1; i >= 0; i -= 1) {
    const m = toolMessages[i] as Record<string, unknown> | null;
    if (!m || typeof m !== "object") {
      continue;
    }
    const name =
      (typeof m.toolName === "string" && m.toolName.trim()) ||
      (typeof m.tool_name === "string" && m.tool_name.trim()) ||
      "";
    if (!name) {
      continue;
    }
    const role = typeof m.role === "string" ? m.role.toLowerCase() : "";
    const hasOutput =
      role === "tool" ||
      role === "function" ||
      typeof m.result !== "undefined" ||
      typeof m.output !== "undefined";
    return hasOutput ? null : name;
  }
  return null;
}

/** Friendly phrase for a running tool, or null when it is not worth narrating. */
export function resolveActiveToolLabel(toolName: string | null | undefined): string | null {
  const name = toolName?.trim().toLowerCase();
  if (!name) {
    return null;
  }
  // The agent's tools are named with underscores ("web_search"); the table
  // is keyed without separators so both spellings find the same phrase.
  const direct = TOOL_LABELS[name] ?? TOOL_LABELS[name.replace(/[-_\s]+/g, "")];
  if (direct) {
    return direct;
  }
  // Skill invocations arrive as "skill:weather" / "skills_weather".
  const skillMatch = /^skills?[:_-](.+)$/.exec(name);
  if (skillMatch?.[1]) {
    const skill = skillMatch[1].replace(/[-_]+/g, " ").trim();
    return skill ? `Using ${skill}…` : "Using a skill…";
  }
  return null;
}
