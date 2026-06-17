/**
 * Thin Codex app-server timeout adapter around DaisyClaw's shared security
 * runtime timeout helper.
 */
import { withTimeout as withSharedTimeout } from "daisyclaw/plugin-sdk/security-runtime";

/** Awaits a promise with a Codex-specific timeout error message. */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  return await withSharedTimeout(promise, timeoutMs, { message: timeoutMessage });
}
