// A config write can schedule a gateway restart. Without a word from the app
// that looks like a crash: the connection drops, a running reply dies, and the
// dashboard shows a reconnect card for no visible reason. Every consumer-facing
// config write runs its response through here so the user is told first.
import { showToast } from "./toast.ts";

export type ConfigWriteRestartInfo = {
  ok?: boolean;
  mode?: string;
  delayMs?: number;
  coalesced?: boolean;
} | null;

export type ConfigWriteResponse = {
  restart?: ConfigWriteRestartInfo;
} | null;

/** True when the gateway told us this write schedules a restart. */
export function configWriteSchedulesRestart(response: ConfigWriteResponse): boolean {
  const restart = response?.restart;
  if (!restart || typeof restart !== "object") {
    return false;
  }
  return restart.ok !== false;
}

/**
 * Warns once that the change requires a restart. Returns true when a restart
 * is coming, so callers can also hold off on follow-up requests.
 */
export function noteConfigWriteRestart(response: ConfigWriteResponse): boolean {
  if (!configWriteSchedulesRestart(response)) {
    return false;
  }
  showToast("Daisy is restarting to apply that. It usually takes a few seconds.", {
    tone: "info",
  });
  return true;
}
