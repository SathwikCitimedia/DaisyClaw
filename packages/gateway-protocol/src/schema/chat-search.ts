// Gateway Protocol schema module for searching message text across chats.
import type { Static } from "typebox";
import { Type } from "typebox";
import { NonEmptyString } from "./primitives.js";

/** Search the words exchanged in the user's recent chats (not just chat names). */
export const ChatSearchParamsSchema = Type.Object(
  {
    query: Type.String({ minLength: 1, maxLength: 200 }),
    /** Only this agent's chats; every agent when omitted. */
    agentId: Type.Optional(NonEmptyString),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  },
  { additionalProperties: false },
);

export const ChatSearchHitSchema = Type.Object(
  {
    sessionKey: NonEmptyString,
    agentId: NonEmptyString,
    sessionLabel: Type.Optional(Type.String()),
    updatedAt: Type.Optional(Type.Number()),
    /** Transcript entry id of the matching message, when it has one. */
    messageId: Type.Optional(Type.String()),
    role: Type.Union([Type.Literal("user"), Type.Literal("assistant")]),
    /** A short excerpt around the match. */
    snippet: Type.String(),
    timestamp: Type.Optional(Type.Number()),
  },
  { additionalProperties: false },
);

export const ChatSearchResultSchema = Type.Object(
  {
    query: Type.String(),
    results: Type.Array(ChatSearchHitSchema),
    scannedSessions: Type.Integer({ minimum: 0 }),
    /** The search stopped at its result cap or time budget before reading every chat. */
    truncated: Type.Boolean(),
  },
  { additionalProperties: false },
);

export type ChatSearchParams = Static<typeof ChatSearchParamsSchema>;
export type ChatSearchHit = Static<typeof ChatSearchHitSchema>;
export type ChatSearchResult = Static<typeof ChatSearchResultSchema>;
