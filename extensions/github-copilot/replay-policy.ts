// Github Copilot plugin module implements replay policy behavior.
import { normalizeLowercaseStringOrEmpty } from "daisyclaw/plugin-sdk/string-coerce-runtime";

export function buildGithubCopilotReplayPolicy(modelId?: string) {
  return normalizeLowercaseStringOrEmpty(modelId).includes("claude")
    ? {
        dropThinkingBlocks: true,
      }
    : {};
}
