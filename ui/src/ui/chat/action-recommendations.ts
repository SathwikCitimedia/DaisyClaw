// Control UI chat module: renders LLM-picked "next action" chips under the
// latest assistant reply. Recommendations are fetched once per session per
// distinct latest-reply text (best-effort) and cached in module state so the
// frequent app re-renders never refetch. Chip clicks run an existing capability
// via a templated follow-up prompt supplied by the caller.
import { html, nothing, type TemplateResult } from "lit";
import {
  RECOMMENDABLE_ACTION_IDS,
  type RecommendableActionId,
} from "../../../../packages/gateway-protocol/src/index.js";
import { icons } from "../icons.ts";
import { extractTextCached } from "./message-extract.ts";

type GatewayClientLike = {
  request: <T>(method: string, params: unknown) => Promise<T>;
};

type ActionRecEntry = {
  signature: string;
  status: "loading" | "ready" | "error";
  actions: RecommendableActionId[];
};

// Bounds the reply text sent for classification; the tail rarely changes intent.
const SIGNATURE_MAX_LENGTH = 8000;

// Keyed by session key: only the latest assistant reply gets chips, so one slot
// per session is enough and it self-invalidates when the reply text changes.
const cache = new Map<string, ActionRecEntry>();

const KNOWN_ACTION_IDS = new Set<string>(RECOMMENDABLE_ACTION_IDS);

type ActionMeta = { label: string; icon: keyof typeof icons; prompt: string };

/** UI-owned label/icon plus the follow-up prompt each chip sends when clicked. */
const ACTION_META: Record<RecommendableActionId, ActionMeta> = {
  summarize: {
    label: "Summarize",
    icon: "fileText",
    prompt: "Summarize your previous response into a few concise key points.",
  },
  short_version: {
    label: "Short version",
    icon: "zap",
    prompt: "Give a much shorter, more concise version of your previous response.",
  },
  research: {
    label: "Research further",
    icon: "search",
    prompt: "Research this topic further and add more depth plus any useful sources.",
  },
  break_steps: {
    label: "Break into steps",
    icon: "scrollText",
    prompt: "Break your previous response into clear, actionable step-by-step tasks.",
  },
  draft_email: {
    label: "Draft as email",
    icon: "send",
    prompt: "Rewrite your previous response as a polished, ready-to-send email.",
  },
  save_memory: {
    label: "Save to memory",
    icon: "bookmark",
    prompt: "Save the key points from your previous response to memory for future reference.",
  },
};

/** The follow-up prompt a chip sends; used by the caller's run handler. */
export function actionPromptFor(id: RecommendableActionId): string {
  return ACTION_META[id].prompt;
}

function findLastAssistantText(messages: readonly unknown[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const role = (message as { role?: unknown } | null)?.role;
    if (role !== "assistant") {
      continue;
    }
    const text = extractTextCached(message)?.trim();
    return text ? text : null;
  }
  return null;
}

function normalizeActionsResult(result: unknown): RecommendableActionId[] {
  const raw = (result as { actions?: unknown } | null)?.actions;
  if (!Array.isArray(raw)) {
    return [];
  }
  const seen = new Set<string>();
  const out: RecommendableActionId[] = [];
  for (const value of raw) {
    if (typeof value === "string" && KNOWN_ACTION_IDS.has(value) && !seen.has(value)) {
      seen.add(value);
      out.push(value as RecommendableActionId);
    }
  }
  return out;
}

function getOrFetchActions(params: {
  client: GatewayClientLike;
  sessionKey: string;
  agentId?: string;
  signature: string;
  onRequestUpdate: () => void;
}): RecommendableActionId[] | null {
  const { client, sessionKey, agentId, signature, onRequestUpdate } = params;
  const existing = cache.get(sessionKey);
  if (existing && existing.signature === signature) {
    return existing.status === "ready" ? existing.actions : null;
  }
  const entry: ActionRecEntry = { signature, status: "loading", actions: [] };
  cache.set(sessionKey, entry);
  void client
    .request("chat.recommendActions", {
      sessionKey,
      messageText: signature,
      ...(agentId ? { agentId } : {}),
    })
    .then((result) => {
      // Ignore if a newer reply superseded this request mid-flight.
      if (cache.get(sessionKey) !== entry) {
        return;
      }
      entry.status = "ready";
      entry.actions = normalizeActionsResult(result);
      onRequestUpdate();
    })
    .catch(() => {
      if (cache.get(sessionKey) !== entry) {
        return;
      }
      entry.status = "error";
      onRequestUpdate();
    });
  return null;
}

/**
 * Renders next-action chips for the latest assistant reply, or `nothing` when
 * unavailable (disconnected, busy, no reply, or no relevant actions). Triggers a
 * one-shot recommendation fetch as a side effect the first time a new reply is
 * seen; safe to call on every render.
 */
export function resolveAssistantActionChips(params: {
  client: GatewayClientLike | null | undefined;
  connected: boolean;
  busy: boolean;
  sessionKey: string;
  agentId?: string;
  messages: readonly unknown[];
  onRequestUpdate: () => void;
  onRun: (id: RecommendableActionId) => void;
}): TemplateResult | typeof nothing {
  if (!params.client || !params.connected || params.busy) {
    return nothing;
  }
  const lastAssistantText = findLastAssistantText(params.messages);
  if (!lastAssistantText) {
    return nothing;
  }
  const signature = lastAssistantText.slice(0, SIGNATURE_MAX_LENGTH);
  const actions = getOrFetchActions({
    client: params.client,
    sessionKey: params.sessionKey,
    ...(params.agentId ? { agentId: params.agentId } : {}),
    signature,
    onRequestUpdate: params.onRequestUpdate,
  });
  if (!actions || actions.length === 0) {
    return nothing;
  }
  return html`
    <div class="chat-action-chips" role="group" aria-label="Suggested next actions">
      ${actions.map((id) => {
        const meta = ACTION_META[id];
        return html`
          <button
            class="chat-action-chip"
            type="button"
            data-action-id=${id}
            @click=${() => params.onRun(id)}
          >
            <span class="chat-action-chip__icon" aria-hidden="true">${icons[meta.icon]}</span>
            <span class="chat-action-chip__label">${meta.label}</span>
          </button>
        `;
      })}
    </div>
  `;
}
