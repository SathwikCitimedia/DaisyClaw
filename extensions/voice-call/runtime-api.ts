// Private runtime barrel for the bundled Voice Call extension.
// Keep this barrel thin and aligned with the local extension surface.

export { definePluginEntry } from "daisyclaw/plugin-sdk/plugin-entry";
export type { DaisyClawPluginApi } from "daisyclaw/plugin-sdk/plugin-entry";
export type { GatewayRequestHandlerOptions } from "daisyclaw/plugin-sdk/gateway-runtime";
export {
  isRequestBodyLimitError,
  readRequestBodyWithLimit,
  requestBodyErrorToText,
} from "daisyclaw/plugin-sdk/webhook-request-guards";
export { fetchWithSsrFGuard, isBlockedHostnameOrIp } from "daisyclaw/plugin-sdk/ssrf-runtime";
export type { SessionEntry } from "daisyclaw/plugin-sdk/session-store-runtime";
export {
  TtsAutoSchema,
  TtsConfigSchema,
  TtsModeSchema,
  TtsProviderSchema,
} from "daisyclaw/plugin-sdk/tts-runtime";
export { sleep } from "daisyclaw/plugin-sdk/runtime-env";
