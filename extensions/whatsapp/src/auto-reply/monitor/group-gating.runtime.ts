// Whatsapp plugin module implements group gating behavior.
export {
  implicitMentionKindWhen,
  resolveInboundMentionDecision,
} from "daisyclaw/plugin-sdk/channel-mention-gating";
export { hasControlCommand } from "daisyclaw/plugin-sdk/command-detection";
export { createChannelHistoryWindow } from "daisyclaw/plugin-sdk/reply-history";
export { parseActivationCommand } from "daisyclaw/plugin-sdk/group-activation";
export { normalizeE164 } from "../../text-runtime.js";
