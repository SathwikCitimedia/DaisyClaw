/**
 * Bundled channel plugin preloading.
 *
 * A channel plugin normally loads only once its channel counts as configured.
 * That is right for a terminal install (nothing unused is paid for) but wrong
 * for the desktop app, where the dashboard is the only way to configure a
 * channel in the first place: WhatsApp's QR login lives on the channel
 * plugin's own gateway surface, so an unloaded plugin answers
 * "web login provider is not available" and the user can never get past it.
 *
 * In consumer builds we therefore preload every bundled channel plugin after
 * the gateway starts listening. Preloading registers the plugin's surface
 * (setup steps, gateway methods) only — no account is started and no network
 * connection is opened until the user actually connects the channel, and the
 * heavy per-channel runtimes stay behind their existing lazy imports.
 */
import { isConsumerLockdownActive } from "../infra/consumer-lockdown.js";

/** Set to 1/0 to force bundled channel preloading on or off (tests, dev). */
export const CHANNEL_PLUGIN_PRELOAD_ENV = "DAISYCLAW_PRELOAD_CHANNEL_PLUGINS";

/**
 * True when bundled channel plugins should be loaded even though their channel
 * is not configured yet. Defaults to consumer builds; the env var overrides it
 * in both directions so the behaviour can be exercised from a source checkout.
 */
export function shouldPreloadBundledChannelPlugins(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[CHANNEL_PLUGIN_PRELOAD_ENV]?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "on") {
    return true;
  }
  if (raw === "0" || raw === "false" || raw === "off") {
    return false;
  }
  return isConsumerLockdownActive(env);
}
