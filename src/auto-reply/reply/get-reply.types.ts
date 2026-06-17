// Shared get-reply type contracts for command, directive, and runtime layers.
import type { DaisyClawConfig } from "../../config/types.daisyclaw.js";
import type { GetReplyOptions } from "../get-reply-options.types.js";
import type { ReplyPayload } from "../reply-payload.js";
import type { MsgContext } from "../templating.js";

/** Reply resolver signature used by dispatchers and tests for dependency injection. */
export type GetReplyFromConfig = (
  ctx: MsgContext,
  opts?: GetReplyOptions,
  configOverride?: DaisyClawConfig,
) => Promise<ReplyPayload | ReplyPayload[] | undefined>;
