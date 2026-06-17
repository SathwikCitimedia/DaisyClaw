// Reads service manager state for status reports.
// Converts gateway/node launchd/systemd state into a compact summary shape.

import {
  summarizeGatewayServiceLayout,
  type GatewayServiceLayoutSummary,
} from "../daemon/service-layout.js";
import type { GatewayServiceRuntime } from "../daemon/service-runtime.js";
import { readGatewayServiceState, type GatewayService } from "../daemon/service.js";

export type ServiceStatusSummary = {
  label: string;
  installed: boolean | null;
  loaded: boolean;
  managedByDaisyClaw: boolean;
  externallyManaged: boolean;
  loadedText: string;
  runtime: GatewayServiceRuntime | undefined;
  layout?: GatewayServiceLayoutSummary;
};

/** Reads a daemon service summary, falling back to unknown when service inspection fails. */
export async function readServiceStatusSummary(
  service: GatewayService,
  fallbackLabel: string,
): Promise<ServiceStatusSummary> {
  try {
    const state = await readGatewayServiceState(service, { env: process.env });
    const layout = await summarizeGatewayServiceLayout(state.command);
    const managedByDaisyClaw = state.installed;
    // A running unmanaged process still counts as installed for status display.
    const externallyManaged = !managedByDaisyClaw && state.running;
    const installed = managedByDaisyClaw || externallyManaged;
    const loadedText = externallyManaged
      ? "running (externally managed)"
      : state.loaded
        ? service.loadedText
        : service.notLoadedText;
    return {
      label: service.label,
      installed,
      loaded: state.loaded,
      managedByDaisyClaw,
      externallyManaged,
      loadedText,
      runtime: state.runtime,
      ...(layout ? { layout } : {}),
    };
  } catch {
    // Status output should survive service-manager errors and show an unknown row.
    return {
      label: fallbackLabel,
      installed: null,
      loaded: false,
      managedByDaisyClaw: false,
      externallyManaged: false,
      loadedText: "unknown",
      runtime: undefined,
    };
  }
}
