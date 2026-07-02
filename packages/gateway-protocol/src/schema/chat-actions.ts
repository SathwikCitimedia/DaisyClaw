// Gateway Protocol schema module for next-action recommendations. Defines the
// closed set of recommendable follow-up actions plus the request/result shapes
// shared by the control UI (chip rendering + execution) and the gateway
// (LLM-picked recommendation + server-side whitelisting).
import type { Static } from "typebox";
import { Type } from "typebox";
import { NonEmptyString } from "./primitives.js";

/**
 * Closed catalog of follow-up actions the recommender may surface. The gateway
 * validates LLM output against this set so an unknown/hallucinated id can never
 * reach the UI, and the UI keys its executor + labels off the same ids.
 */
export const RECOMMENDABLE_ACTION_IDS = [
  "summarize",
  "short_version",
  "research",
  "break_steps",
  "draft_email",
  "save_memory",
] as const;

export type RecommendableActionId = (typeof RECOMMENDABLE_ACTION_IDS)[number];

/** Upper bound on the reply text sent for classification; UI trims before send. */
export const CHAT_RECOMMEND_ACTIONS_TEXT_MAX_LENGTH = 100_000;

/** Request to rank follow-up actions for a single assistant reply. */
export const ChatRecommendActionsParamsSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    agentId: Type.Optional(NonEmptyString),
    messageText: Type.String({ maxLength: CHAT_RECOMMEND_ACTIONS_TEXT_MAX_LENGTH }),
  },
  { additionalProperties: false },
);

/** Ordered, whitelisted action ids most relevant to the reply (most-relevant first). */
export const ChatRecommendActionsResultSchema = Type.Object(
  {
    actions: Type.Array(Type.Union(RECOMMENDABLE_ACTION_IDS.map((id) => Type.Literal(id)))),
  },
  { additionalProperties: false },
);

export type ChatRecommendActionsParams = Static<typeof ChatRecommendActionsParamsSchema>;
export type ChatRecommendActionsResult = Static<typeof ChatRecommendActionsResultSchema>;
