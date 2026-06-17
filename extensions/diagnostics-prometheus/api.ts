// Diagnostics Prometheus API module exposes the plugin public contract.
export type {
  DiagnosticEventMetadata,
  DiagnosticEventPayload,
} from "daisyclaw/plugin-sdk/diagnostic-runtime";
export { isInternalDiagnosticEventMetadata } from "daisyclaw/plugin-sdk/diagnostic-runtime";
export {
  emptyPluginConfigSchema,
  type DaisyClawPluginApi,
  type DaisyClawPluginHttpRouteHandler,
  type DaisyClawPluginService,
  type DaisyClawPluginServiceContext,
} from "daisyclaw/plugin-sdk/plugin-entry";
export { redactSensitiveText } from "daisyclaw/plugin-sdk/security-runtime";
