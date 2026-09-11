/**
 * Consumer-build lockdown flag.
 *
 * The packaged consumer build (the Daisy Assistant .exe) bakes this on so
 * factory files — the SOUL.md persona — are invisible and immutable through
 * every gateway client (Control UI, Debug console, any RPC caller), and fresh
 * workspaces are seeded with the production persona instead of the dev
 * template. Dev installs keep full workspace editing.
 */

// Flipped to `true` by the consumer packaging step. Do not edit by hand.
const CONSUMER_LOCKDOWN_BAKED = false;

/**
 * True when the consumer lockdown applies.
 *
 * The baked flag cannot be turned off at runtime — a packaged build stays
 * locked regardless of environment. DAISYCLAW_CONSUMER_LOCKDOWN=1 force-enables
 * the lockdown on dev installs so the consumer behavior can be verified
 * without a packaged build.
 */
export function isConsumerLockdownActive(env: NodeJS.ProcessEnv = process.env): boolean {
  if (CONSUMER_LOCKDOWN_BAKED) {
    return true;
  }
  const override = env.DAISYCLAW_CONSUMER_LOCKDOWN?.trim().toLowerCase();
  return override === "1" || override === "true";
}
