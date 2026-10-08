// Gateway Protocol schema module for connecting the accounts Daisy uses through
// her own tools (Google through gog, Spotify through spotify_player).
import type { Static } from "typebox";
import { Type } from "typebox";

export const ConnectableServiceSchema = Type.Union([
  Type.Literal("google"),
  Type.Literal("spotify"),
]);

export const ConnectionJobViewSchema = Type.Object(
  {
    state: Type.Union([
      Type.Literal("running"),
      Type.Literal("succeeded"),
      Type.Literal("failed"),
      Type.Literal("cancelled"),
    ]),
    startedAt: Type.Number(),
    finishedAt: Type.Optional(Type.Number()),
    message: Type.Optional(Type.String()),
    /** The sign-in page, for when the browser did not open by itself. */
    authUrl: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export const ConnectionsStatusParamsSchema = Type.Object(
  {
    /** Only report sign-ins in progress (cheap; for polling while the user is in the browser). */
    jobsOnly: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export const ConnectionsGoogleSetClientParamsSchema = Type.Object(
  {
    /** The Desktop-app OAuth client file the user downloaded from Google Cloud. */
    credentialsJson: Type.String({ minLength: 2, maxLength: 65_536 }),
  },
  { additionalProperties: false },
);

export const ConnectionsConnectParamsSchema = Type.Object(
  {
    service: ConnectableServiceSchema,
    /** The Google address to sign in; required for Google. */
    email: Type.Optional(Type.String({ maxLength: 254 })),
  },
  { additionalProperties: false },
);

export const ConnectionsCancelParamsSchema = Type.Object(
  { service: ConnectableServiceSchema },
  { additionalProperties: false },
);

export const ConnectionsDisconnectParamsSchema = Type.Object(
  {
    service: ConnectableServiceSchema,
    email: Type.Optional(Type.String({ maxLength: 254 })),
  },
  { additionalProperties: false },
);

export const ConnectionsCheckKeysParamsSchema = Type.Object(
  {
    /** The skill the values are for, e.g. "notion". */
    skillKey: Type.String({ minLength: 1, maxLength: 128 }),
    /** The values to check, keyed by the environment variable the skill reads. */
    env: Type.Record(
      Type.String({ minLength: 1, maxLength: 128 }),
      Type.String({ maxLength: 4096 }),
    ),
  },
  { additionalProperties: false },
);

export const ConnectionsCheckKeysResultSchema = Type.Object(
  {
    status: Type.Union([
      Type.Literal("valid"),
      Type.Literal("invalid"),
      Type.Literal("unreachable"),
      Type.Literal("unchecked"),
    ]),
    /** What to tell the person when the values were refused or could not be checked. */
    message: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type ConnectableService = Static<typeof ConnectableServiceSchema>;
export type ConnectionsCheckKeysParams = Static<typeof ConnectionsCheckKeysParamsSchema>;
export type ConnectionsCheckKeysResult = Static<typeof ConnectionsCheckKeysResultSchema>;
export type ConnectionJobView = Static<typeof ConnectionJobViewSchema>;
export type ConnectionsStatusParams = Static<typeof ConnectionsStatusParamsSchema>;
export type ConnectionsGoogleSetClientParams = Static<
  typeof ConnectionsGoogleSetClientParamsSchema
>;
export type ConnectionsConnectParams = Static<typeof ConnectionsConnectParamsSchema>;
export type ConnectionsCancelParams = Static<typeof ConnectionsCancelParamsSchema>;
export type ConnectionsDisconnectParams = Static<typeof ConnectionsDisconnectParamsSchema>;
