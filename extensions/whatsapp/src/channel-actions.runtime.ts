// Whatsapp plugin module implements channel actions behavior.
import { createActionGate } from "daisyclaw/plugin-sdk/channel-actions";
import type { ChannelMessageActionName } from "daisyclaw/plugin-sdk/channel-contract";
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";

export { listWhatsAppAccountIds, resolveWhatsAppAccount } from "./accounts.js";
export { resolveWhatsAppReactionLevel } from "./reaction-level.js";
export { createActionGate, type ChannelMessageActionName, type DaisyClawConfig };
