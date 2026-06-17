// Telegram plugin module implements bot message dispatch behavior.
export {
  loadSessionStore,
  readLatestAssistantTextFromSessionTranscript,
  resolveAndPersistSessionFile,
  resolveSessionStoreEntry,
  updateSessionStoreEntry,
} from "daisyclaw/plugin-sdk/session-store-runtime";
export { resolveMarkdownTableMode } from "daisyclaw/plugin-sdk/markdown-table-runtime";
export { getAgentScopedMediaLocalRoots } from "daisyclaw/plugin-sdk/media-runtime";
export { resolveChunkMode } from "daisyclaw/plugin-sdk/reply-dispatch-runtime";
export {
  generateTelegramTopicLabel as generateTopicLabel,
  resolveAutoTopicLabelConfig,
} from "./auto-topic-label.js";
