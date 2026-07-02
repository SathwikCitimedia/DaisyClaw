// Recommends up to a few follow-up actions for an assistant reply, LLM-picked.
// Reuses the session-auto-title completion path so recommendations run on the
// user-configured model for the agent (never a hardcoded model), and hard-
// whitelists the model output against the closed action catalog so a
// hallucinated id can never reach the UI.
import {
  RECOMMENDABLE_ACTION_IDS,
  type RecommendableActionId,
} from "../../packages/gateway-protocol/src/index.js";
import { generateConversationLabel } from "../auto-reply/reply/conversation-label-generator.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";

/** Never surface more than this many chips; the model is told to prefer fewer. */
export const MAX_RECOMMENDED_ACTIONS = 3;

/** Short model-facing description of each action, keyed by its catalog id. */
const ACTION_MENU: Record<RecommendableActionId, string> = {
  summarize: "Summarize the reply into concise key points.",
  short_version: "Restate the reply much more briefly.",
  research: "Research the topic further for more detail or sources.",
  break_steps: "Turn the reply into a step-by-step action plan.",
  draft_email: "Rewrite the reply as a ready-to-send email.",
  save_memory: "Save the important facts from the reply to long-term memory.",
};

const RECOMMENDER_SYSTEM_PROMPT = [
  "You suggest useful follow-up actions a user might take after reading an assistant's reply.",
  `Choose only from these action ids (id — meaning):`,
  ...RECOMMENDABLE_ACTION_IDS.map((id) => `- ${id} — ${ACTION_MENU[id]}`),
  "Rules:",
  `- Pick at most ${MAX_RECOMMENDED_ACTIONS}, only ones that genuinely fit THIS reply. Fewer is better.`,
  "- Order them most-relevant first.",
  '- Reply with ONLY a JSON array of id strings, e.g. ["summarize","draft_email"].',
  "- If none fit, reply with [].",
].join("\n");

const KNOWN_ACTION_IDS = new Set<string>(RECOMMENDABLE_ACTION_IDS);

/** Strips markdown code fences the model may wrap the JSON array in. */
function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();
}

/**
 * Parses the model output into ordered, deduped, whitelisted ids. Falls back to
 * scanning for known ids in first-seen order when the output is not valid JSON.
 */
export function parseRecommendedActionIds(raw: string | null | undefined): RecommendableActionId[] {
  if (typeof raw !== "string" || !raw.trim()) {
    return [];
  }
  const text = stripCodeFences(raw);
  const seen = new Set<string>();
  const out: RecommendableActionId[] = [];
  const push = (value: unknown) => {
    if (typeof value !== "string" || out.length >= MAX_RECOMMENDED_ACTIONS) {
      return;
    }
    const id = value.trim();
    if (KNOWN_ACTION_IDS.has(id) && !seen.has(id)) {
      seen.add(id);
      out.push(id as RecommendableActionId);
    }
  };
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      parsed.forEach(push);
      return out;
    }
  } catch {
    // Fall through to substring scan below.
  }
  // Fallback: recover ids embedded in prose, preserving order of appearance.
  const found: { id: RecommendableActionId; at: number }[] = [];
  for (const id of RECOMMENDABLE_ACTION_IDS) {
    const at = text.indexOf(id);
    if (at >= 0) {
      found.push({ id, at });
    }
  }
  for (const entry of found.toSorted((a, b) => a.at - b.at)) {
    push(entry.id);
  }
  return out;
}

export type RecommendActionsParams = {
  messageText: string;
  cfg: DaisyClawConfig;
  agentId?: string;
  agentDir?: string;
  debug?: (message: string) => void;
};

/** Returns LLM-picked, whitelisted follow-up action ids for a reply (best-effort). */
export async function generateActionRecommendations(
  params: RecommendActionsParams,
): Promise<RecommendableActionId[]> {
  const trimmed = params.messageText.trim();
  if (!trimmed) {
    return [];
  }
  const raw = await generateConversationLabel({
    userMessage: trimmed,
    prompt: RECOMMENDER_SYSTEM_PROMPT,
    cfg: params.cfg,
    ...(params.agentId ? { agentId: params.agentId } : {}),
    ...(params.agentDir ? { agentDir: params.agentDir } : {}),
    maxLength: 200,
  });
  const actions = parseRecommendedActionIds(raw);
  params.debug?.(`raw=${JSON.stringify(raw)} parsed=${JSON.stringify(actions)}`);
  return actions;
}
