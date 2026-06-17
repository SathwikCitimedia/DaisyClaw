// Diagnostics Otel API module exposes the plugin public contract.
export {
  createChildDiagnosticTraceContext,
  createDiagnosticTraceContext,
  emitDiagnosticEvent,
  formatDiagnosticTraceparent,
  isValidDiagnosticSpanId,
  isValidDiagnosticTraceFlags,
  isValidDiagnosticTraceId,
  onDiagnosticEvent,
  parseDiagnosticTraceparent,
  type DiagnosticEventMetadata,
  type DiagnosticEventPayload,
  type DiagnosticTraceContext,
} from "daisyclaw/plugin-sdk/diagnostic-runtime";
export { emptyPluginConfigSchema, type DaisyClawPluginApi } from "daisyclaw/plugin-sdk/plugin-entry";
export type {
  DaisyClawPluginService,
  DaisyClawPluginServiceContext,
} from "daisyclaw/plugin-sdk/plugin-entry";
export { redactSensitiveText } from "daisyclaw/plugin-sdk/security-runtime";
