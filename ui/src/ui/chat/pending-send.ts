// Control UI chat module decides where a just-sent message is shown while the
// gateway confirms it, and reads how its delivery is going.
import type { ChatQueueItem } from "../ui-types.ts";

/**
 * A message the person sent is shown in the conversation straight away, with
 * how its delivery is going underneath; the Queued panel is only for messages
 * waiting behind a reply that is still running.
 */
export function shouldRenderQueuedSendInThread(item: ChatQueueItem): boolean {
  if (typeof item.sendSubmittedAtMs !== "number") {
    return false;
  }
  return (
    item.sendState === "waiting-model" ||
    item.sendState === "sending" ||
    item.sendState === "waiting-reconnect" ||
    item.sendState === "failed"
  );
}

export type PendingSendMarker = {
  id: string;
  state: NonNullable<ChatQueueItem["sendState"]>;
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** How delivery of a just-sent message is going, when the message is one. */
export function readPendingSendMarker(message: unknown): PendingSendMarker | null {
  const marker = asRecord(asRecord(message)?.["__daisyclaw"]);
  if (marker?.kind !== "pending-send" || typeof marker.id !== "string") {
    return null;
  }
  const state = marker.state;
  if (
    state !== "sending" &&
    state !== "waiting-model" &&
    state !== "waiting-reconnect" &&
    state !== "failed"
  ) {
    return null;
  }
  return {
    id: marker.id,
    state,
    ...(typeof marker.error === "string" && marker.error ? { error: marker.error } : {}),
  };
}
