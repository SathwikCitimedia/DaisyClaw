// Telegram helper module supports message tool schema behavior.
import { optionalPositiveIntegerSchema } from "daisyclaw/plugin-sdk/channel-actions";
import { Type } from "typebox";

export function createTelegramPollExtraToolSchemas() {
  return {
    pollDurationSeconds: optionalPositiveIntegerSchema(),
    pollAnonymous: Type.Optional(Type.Boolean()),
    pollPublic: Type.Optional(Type.Boolean()),
  };
}
