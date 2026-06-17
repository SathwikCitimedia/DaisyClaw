// Matrix plugin module implements monitor route test support behavior.
export {
  registerSessionBindingAdapter,
  testing,
} from "daisyclaw/plugin-sdk/session-binding-runtime";
export { resolveAgentRoute } from "daisyclaw/plugin-sdk/routing";
export {
  createTestRegistry,
  setActivePluginRegistry,
} from "daisyclaw/plugin-sdk/plugin-test-runtime";
export type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
