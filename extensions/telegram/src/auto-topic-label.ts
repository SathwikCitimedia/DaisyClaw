// Telegram plugin module implements auto topic label behavior.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
import { generateConversationLabel } from "daisyclaw/plugin-sdk/reply-dispatch-runtime";
export { resolveAutoTopicLabelConfig } from "./auto-topic-label-config.js";

export async function generateTelegramTopicLabel(params: {
  userMessage: string;
  prompt: string;
  cfg: DaisyClawConfig;
  agentId?: string;
  agentDir?: string;
}): Promise<string | null> {
  return await generateConversationLabel({
    ...params,
    maxLength: 128,
  });
}
