// Telegram API module exposes the plugin public contract.
export {
  buildChannelConfigSchema,
  TelegramConfigSchema,
} from "daisyclaw/plugin-sdk/bundled-channel-config-schema";
export {
  normalizeTelegramCommandDescription,
  normalizeTelegramCommandName,
  resolveTelegramCustomCommands,
} from "./src/command-config.js";
