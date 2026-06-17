// Imessage plugin module implements runtime behavior.
import type { PluginRuntime } from "daisyclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "daisyclaw/plugin-sdk/runtime-store";

const {
  clearRuntime: clearIMessageRuntime,
  getRuntime: getIMessageRuntime,
  setRuntime: setIMessageRuntime,
  tryGetRuntime: getOptionalIMessageRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "imessage",
  errorMessage: "iMessage runtime not initialized",
});
export { clearIMessageRuntime, getIMessageRuntime, getOptionalIMessageRuntime, setIMessageRuntime };
