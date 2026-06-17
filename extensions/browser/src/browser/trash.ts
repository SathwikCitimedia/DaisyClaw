/**
 * Trash helpers for Browser-owned files constrained to user and DaisyClaw temp
 * roots.
 */
import os from "node:os";
import { movePathToTrash as movePathToTrashWithAllowedRoots } from "daisyclaw/plugin-sdk/browser-config";
import { resolvePreferredDaisyClawTmpDir } from "daisyclaw/plugin-sdk/temp-path";

/** Moves a path to trash only when it lives under allowed Browser roots. */
export async function movePathToTrash(targetPath: string): Promise<string> {
  return await movePathToTrashWithAllowedRoots(targetPath, {
    allowedRoots: [os.homedir(), resolvePreferredDaisyClawTmpDir()],
  });
}
