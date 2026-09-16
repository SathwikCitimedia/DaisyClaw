// Browser-side half of "Reset Daisy": remembers that a reset is in flight so
// the dashboard can show a calm "Resetting…" card across the gateway restart,
// then reload into the first-run wizard once the fresh gateway is back.
//
// The gateway keeps the connection token, so the only local state we drop is
// what describes the user's old install (first-run marker, identities, drafts).
import { getSafeLocalStorage } from "../local-storage.ts";

export const FACTORY_RESET_PENDING_KEY = "daisyclaw.control.factoryResetPending.v1";
/** Set when the gateway reports files the reset could not remove yet; shown once in the wizard. */
export const FACTORY_RESET_LEFTOVERS_KEY = "daisyclaw.control.factoryResetLeftovers.v1";
/** Confirm phrase the gateway requires; mirrors FACTORY_RESET_CONFIRM_PHRASE server-side. */
export const FACTORY_RESET_CONFIRM_PHRASE = "erase-everything";
/** Give the gateway this long to come back before treating the reset as failed. */
export const FACTORY_RESET_PENDING_TTL_MS = 5 * 60_000;

/** Local keys that describe the connection itself and must survive a reset. */
const PRESERVED_LOCAL_KEY_PREFIXES = [
  "daisyclaw.control.settings.v1",
  "daisyclaw.control.token.v1",
  FACTORY_RESET_PENDING_KEY,
  FACTORY_RESET_LEFTOVERS_KEY,
];

/** Remembers how many old files the reset left on disk, for the wizard to mention once. */
export function markFactoryResetLeftovers(count: number): void {
  try {
    if (count > 0) {
      getSafeLocalStorage()?.setItem(FACTORY_RESET_LEFTOVERS_KEY, String(count));
    } else {
      getSafeLocalStorage()?.removeItem(FACTORY_RESET_LEFTOVERS_KEY);
    }
  } catch {
    // Cosmetic only.
  }
}

export function readFactoryResetLeftovers(): number {
  try {
    const raw = getSafeLocalStorage()?.getItem(FACTORY_RESET_LEFTOVERS_KEY);
    const value = Number(raw ?? "0");
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function clearFactoryResetLeftovers(): void {
  try {
    getSafeLocalStorage()?.removeItem(FACTORY_RESET_LEFTOVERS_KEY);
  } catch {
    // ignore
  }
}

export function markFactoryResetPending(nowMs: number = Date.now()): void {
  try {
    getSafeLocalStorage()?.setItem(FACTORY_RESET_PENDING_KEY, String(nowMs));
  } catch {
    // Without storage the page simply reconnects normally after the restart.
  }
}

export function readFactoryResetPendingAt(): number | null {
  try {
    const raw = getSafeLocalStorage()?.getItem(FACTORY_RESET_PENDING_KEY);
    if (!raw) {
      return null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearFactoryResetPending(): void {
  try {
    getSafeLocalStorage()?.removeItem(FACTORY_RESET_PENDING_KEY);
  } catch {
    // ignore
  }
}

/** True while a reset was requested less than the TTL ago. */
export function isFactoryResetPending(nowMs: number = Date.now()): boolean {
  const at = readFactoryResetPendingAt();
  if (at === null) {
    return false;
  }
  if (nowMs - at > FACTORY_RESET_PENDING_TTL_MS) {
    clearFactoryResetPending();
    return false;
  }
  return true;
}

/**
 * Drops every local "daisyclaw.control.*" record except the ones that hold
 * the gateway address/token, so the reloaded page connects straight away and
 * then sees a fresh install (first-run wizard included).
 */
export function clearLocalStateForFactoryReset(): void {
  const storage = getSafeLocalStorage();
  if (!storage) {
    return;
  }
  const doomed: string[] = [];
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key || !key.startsWith("daisyclaw.")) {
        continue;
      }
      if (PRESERVED_LOCAL_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        continue;
      }
      doomed.push(key);
    }
    for (const key of doomed) {
      storage.removeItem(key);
    }
  } catch {
    // Best-effort; stale local records only affect cosmetics.
  }
}
