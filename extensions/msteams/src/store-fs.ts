// Msteams plugin module implements store fs behavior.
import { withFileLock as withPathLock } from "daisyclaw/plugin-sdk/file-lock";
import { writeJsonFileAtomically } from "daisyclaw/plugin-sdk/json-store";
import { pathExists } from "daisyclaw/plugin-sdk/security-runtime";

const STORE_LOCK_OPTIONS = {
  retries: {
    retries: 10,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 10_000,
    randomize: true,
  },
  stale: 30_000,
} as const;

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeJsonFileAtomically(filePath, value);
}

async function ensureJsonFile(filePath: string, fallback: unknown) {
  if (!(await pathExists(filePath))) {
    await writeJsonFile(filePath, fallback);
  }
}

export async function withFileLock<T>(
  filePath: string,
  fallback: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  await ensureJsonFile(filePath, fallback);
  return await withPathLock(filePath, STORE_LOCK_OPTIONS, async () => {
    return await fn();
  });
}
