// Qqbot plugin module implements runtime behavior.
import type { PluginRuntime } from "daisyclaw/plugin-sdk/core";
import { createPluginRuntimeStore } from "daisyclaw/plugin-sdk/runtime-store";
import type { GatewayPluginRuntime } from "../engine/gateway/types.js";
import { setDaisyClawVersion } from "../engine/messaging/sender.js";

// Single plugin runtime per process — concurrent multi-tenant qqbot runtimes are not supported.
const {
  setRuntime: _setRuntime,
  clearRuntime: resetQQBotRuntimeForTest,
  getRuntime: getQQBotRuntime,
} = createPluginRuntimeStore<PluginRuntime>({
  pluginId: "qqbot",
  errorMessage: "QQBot runtime not initialized",
});

/** Set the QQBot runtime and inject the framework version into the User-Agent. */
function setQQBotRuntime(runtime: PluginRuntime): void {
  _setRuntime(runtime);
  // Inject the framework version into the User-Agent string (same as standalone).
  setDaisyClawVersion(runtime.version);
}

export { getQQBotRuntime, resetQQBotRuntimeForTest, setQQBotRuntime };

/** Type-narrowed getter for engine/ modules that need GatewayPluginRuntime. */
export function getQQBotRuntimeForEngine(): GatewayPluginRuntime {
  return getQQBotRuntime() as GatewayPluginRuntime;
}
