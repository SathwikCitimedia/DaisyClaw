// Gateway handler for chat.search: find the words people exchanged, across their recent chats.
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateChatSearchParams,
} from "../../../packages/gateway-protocol/src/index.js";
import { searchChatTranscripts } from "../chat-search.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers } from "./types.js";

export const chatSearchHandlers: GatewayRequestHandlers = {
  "chat.search": async ({ params, respond, context }) => {
    if (!validateChatSearchParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid chat.search params: ${formatValidationErrors(validateChatSearchParams.errors)}`,
        ),
      );
      return;
    }
    try {
      const result = await searchChatTranscripts({
        cfg: context.getRuntimeConfig(),
        query: params.query,
        ...(params.agentId ? { agentId: params.agentId } : {}),
        ...(typeof params.limit === "number" ? { limit: params.limit } : {}),
      });
      respond(true, result, undefined);
    } catch (err) {
      context.logGateway.warn(`chat.search failed: ${formatForLog(err)}`);
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, "Searching your chats failed. Try again in a moment."),
      );
    }
  },
};
