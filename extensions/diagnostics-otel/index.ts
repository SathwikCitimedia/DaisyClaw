// Diagnostics Otel plugin entrypoint registers its DaisyClaw integration.
import { definePluginEntry } from "daisyclaw/plugin-sdk/plugin-entry";
import { createDiagnosticsOtelService } from "./src/service.js";

export default definePluginEntry({
  id: "diagnostics-otel",
  name: "Diagnostics OpenTelemetry",
  description: "Export diagnostics events to OpenTelemetry",
  register(api) {
    api.registerService(createDiagnosticsOtelService());
  },
});
