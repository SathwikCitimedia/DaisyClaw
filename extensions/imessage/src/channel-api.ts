// Imessage API module exposes the plugin public contract.
import { formatTrimmedAllowFromEntries } from "daisyclaw/plugin-sdk/channel-config-helpers";
import { PAIRING_APPROVED_MESSAGE } from "daisyclaw/plugin-sdk/channel-status";
import {
  DEFAULT_ACCOUNT_ID,
  getChatChannelMeta,
  type ChannelPlugin,
} from "daisyclaw/plugin-sdk/core";
import { resolveChannelMediaMaxBytes } from "daisyclaw/plugin-sdk/media-runtime";
import { collectStatusIssuesFromLastError } from "daisyclaw/plugin-sdk/status-helpers";
import { normalizeIMessageMessagingTarget } from "./normalize.js";
export { chunkTextForOutbound } from "daisyclaw/plugin-sdk/text-chunking";

export {
  collectStatusIssuesFromLastError,
  DEFAULT_ACCOUNT_ID,
  formatTrimmedAllowFromEntries,
  getChatChannelMeta,
  normalizeIMessageMessagingTarget,
  PAIRING_APPROVED_MESSAGE,
  resolveChannelMediaMaxBytes,
};

export type { ChannelPlugin };
