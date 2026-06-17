// Telegram plugin module implements runtime behavior.
import { createPluginRuntimeStore } from "daisyclaw/plugin-sdk/runtime-store";
import type { TelegramRuntime } from "./runtime.types.js";

const {
  setRuntime: setTelegramRuntime,
  clearRuntime: clearTelegramRuntime,
  getRuntime: getTelegramRuntime,
  tryGetRuntime: getOptionalTelegramRuntime,
} = createPluginRuntimeStore<TelegramRuntime>({
  pluginId: "telegram",
  errorMessage: "Telegram runtime not initialized",
});
export { clearTelegramRuntime, getOptionalTelegramRuntime, getTelegramRuntime, setTelegramRuntime };
