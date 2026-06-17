// Whatsapp plugin module implements text runtime behavior.
export {
  convertMarkdownTables,
  sanitizeAssistantVisibleText,
  sanitizeAssistantVisibleTextWithProfile,
  stripToolCallXmlTags,
} from "daisyclaw/plugin-sdk/text-chunking";
export { normalizeE164, resolveUserPath, sleep } from "daisyclaw/plugin-sdk/text-utility-runtime";
export {
  assertWebChannel,
  isSelfChatMode,
  jidToE164,
  markdownToWhatsApp,
  resolveJidToE164,
  toWhatsappJid,
  toWhatsappJidWithLid,
  type JidToE164Options,
  type WebChannel,
} from "./targets-runtime.js";
