/**
 * Factory reset: erase everything the user created and start from a fresh
 * install, while keeping the pipe between the desktop app and the engine.
 *
 * The reset runs in two halves because files cannot be deleted safely while
 * channels (WhatsApp session files, browser profiles, SQLite stores) still
 * hold them open:
 *
 *   1. `system.factoryReset` (gateway method) writes a small marker into the
 *      state dir and schedules the normal in-process gateway restart.
 *   2. On the next start — the in-process restart iteration or, after a
 *      crash, plain process boot — `applyPendingFactoryReset` finds the
 *      marker, wipes the state dir and agent workspaces, and seeds the same
 *      first-run config a brand-new install gets.
 *
 * What survives: the gateway auth token/password, port and bind (so the tray
 * app reconnects by itself instead of landing on a login page), the gateway's
 * own device identity and paired-device records (same reason), and the
 * scheduled-task launcher script that lives in the state dir.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { resolveDefaultAgentWorkspaceDir } from "../agents/workspace-default.js";
import { resolveStateDir } from "../config/paths.js";
import type { DaisyClawConfig } from "../config/types.js";
import { resolveRequiredHomeDir } from "./home-dir.js";

export const FACTORY_RESET_MARKER_FILENAME = "factory-reset-pending.json";
export const FACTORY_RESET_CONFIRM_PHRASE = "erase-everything";
/** Where the last reset's outcome (including anything it could not remove) is kept. */
export const FACTORY_RESET_RESULT_FILENAME = "factory-reset-result.json";

/** Persisted outcome of the last applied reset, read back by `system.factoryResetStatus`. */
export type FactoryResetResultRecord = {
  kind: "factory-reset-result";
  appliedAt: string;
  requestedAt: string;
  removed: number;
  /** Paths still on disk after the reset and its retries. Empty means a clean reset. */
  skipped: Array<{ path: string; error: string }>;
  /** How many later starts have retried the leftovers. */
  retries: number;
};

/** A marker older than this is ignored (and removed) instead of wiping data. */
const FACTORY_RESET_MARKER_TTL_MS = 30 * 60_000;

/**
 * State-dir entries that survive a reset. Everything here is plumbing between
 * the desktop app and the engine, never user content.
 */
export const FACTORY_RESET_PRESERVED_ENTRIES: ReadonlySet<string> = new Set([
  "gateway.cmd",
  // The packaged app starts through the silent .vbs launcher, not the .cmd:
  // the installer sets DAISYCLAW_WINDOWS_TASK_HIDDEN_LAUNCHER, so the scheduled
  // task's command is gateway.vbs. Deleting it left the task pointing at a file
  // that no longer existed, and Daisy never came back after the next restart.
  "gateway.vbs",
  "identity",
  "devices",
  FACTORY_RESET_MARKER_FILENAME,
]);

export type FactoryResetPreservedGateway = {
  mode?: string;
  port?: number;
  bind?: string;
  authMode?: string;
  token?: string;
  password?: string;
};

export type FactoryResetMarker = {
  kind: "factory-reset";
  requestedAt: number;
  pid: number;
  preserve: FactoryResetPreservedGateway;
  /** Absolute workspace directories to remove alongside the state dir. */
  workspaces: string[];
};

export type FactoryResetOutcome = {
  stateDir: string;
  removed: string[];
  skipped: Array<{ path: string; error: string }>;
  configPath: string;
  requestedAt: number;
};

export type FactoryResetLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

function resolveMarkerPath(env: NodeJS.ProcessEnv): string {
  return path.join(resolveStateDir(env), FACTORY_RESET_MARKER_FILENAME);
}

function expandHome(raw: string, home: string): string {
  if (raw === "~") {
    return home;
  }
  if (raw.startsWith("~/") || raw.startsWith("~\\")) {
    return path.join(home, raw.slice(2));
  }
  return raw;
}

function isInside(parent: string, child: string): boolean {
  const rel = path.relative(parent, child);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Workspace directories a reset may delete: the default workspace plus any
 * workspace the config points at, restricted to directories inside the home
 * directory (never the home directory itself, never system paths).
 */
export function collectFactoryResetWorkspaces(
  cfg: DaisyClawConfig,
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string[] {
  const home = path.resolve(resolveRequiredHomeDir(env, homedir));
  const candidates: string[] = [resolveDefaultAgentWorkspaceDir(env, homedir)];
  const defaults = cfg.agents?.defaults as { workspace?: unknown } | undefined;
  if (typeof defaults?.workspace === "string" && defaults.workspace.trim()) {
    candidates.push(defaults.workspace.trim());
  }
  const list = (cfg.agents as { list?: unknown } | undefined)?.list;
  if (Array.isArray(list)) {
    for (const entry of list) {
      const workspace = (entry as { workspace?: unknown } | null)?.workspace;
      if (typeof workspace === "string" && workspace.trim()) {
        candidates.push(workspace.trim());
      }
    }
  }
  const safe = new Set<string>();
  for (const candidate of candidates) {
    const resolved = path.resolve(expandHome(candidate, home));
    if (isInside(home, resolved)) {
      safe.add(resolved);
    }
  }
  return [...safe];
}

function readPreservedGateway(cfg: DaisyClawConfig): FactoryResetPreservedGateway {
  const gateway = cfg.gateway;
  const preserve: FactoryResetPreservedGateway = {};
  if (typeof gateway?.mode === "string") {
    preserve.mode = gateway.mode;
  }
  if (typeof gateway?.port === "number" && Number.isFinite(gateway.port)) {
    preserve.port = gateway.port;
  }
  if (typeof gateway?.bind === "string") {
    preserve.bind = gateway.bind;
  }
  if (typeof gateway?.auth?.mode === "string") {
    preserve.authMode = gateway.auth.mode;
  }
  if (typeof gateway?.auth?.token === "string" && gateway.auth.token) {
    preserve.token = gateway.auth.token;
  }
  if (typeof gateway?.auth?.password === "string" && gateway.auth.password) {
    preserve.password = gateway.auth.password;
  }
  return preserve;
}

/** Records the reset request; the wipe itself happens on the next gateway start. */
export function writeFactoryResetMarkerSync(params: {
  cfg: DaisyClawConfig;
  env?: NodeJS.ProcessEnv;
  now?: number;
}): FactoryResetMarker {
  const env = params.env ?? process.env;
  const marker: FactoryResetMarker = {
    kind: "factory-reset",
    requestedAt: params.now ?? Date.now(),
    pid: process.pid,
    preserve: readPreservedGateway(params.cfg),
    workspaces: collectFactoryResetWorkspaces(params.cfg, env),
  };
  const markerPath = resolveMarkerPath(env);
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`, { mode: 0o600 });
  return marker;
}

export function readPendingFactoryResetMarkerSync(
  env: NodeJS.ProcessEnv = process.env,
  now: number = Date.now(),
): FactoryResetMarker | null {
  const markerPath = resolveMarkerPath(env);
  let raw: string;
  try {
    raw = fs.readFileSync(markerPath, "utf8");
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    safeUnlink(markerPath);
    return null;
  }
  const marker = parsed as Partial<FactoryResetMarker> | null;
  if (
    !marker ||
    marker.kind !== "factory-reset" ||
    typeof marker.requestedAt !== "number" ||
    !Number.isFinite(marker.requestedAt)
  ) {
    safeUnlink(markerPath);
    return null;
  }
  if (now - marker.requestedAt > FACTORY_RESET_MARKER_TTL_MS) {
    safeUnlink(markerPath);
    return null;
  }
  return {
    kind: "factory-reset",
    requestedAt: marker.requestedAt,
    pid: typeof marker.pid === "number" ? marker.pid : 0,
    preserve:
      marker.preserve && typeof marker.preserve === "object"
        ? (marker.preserve as FactoryResetPreservedGateway)
        : {},
    workspaces: Array.isArray(marker.workspaces)
      ? marker.workspaces.filter((entry): entry is string => typeof entry === "string")
      : [],
  };
}

export function hasPendingFactoryResetSync(env: NodeJS.ProcessEnv = process.env): boolean {
  return readPendingFactoryResetMarkerSync(env) !== null;
}

function safeUnlink(target: string): void {
  try {
    fs.rmSync(target, { force: true });
  } catch {
    // Best-effort.
  }
}

/**
 * Entries that hold files other code keeps open (the shared SQLite store)
 * get a much longer retry budget: on Windows a handle that was just closed
 * can take a moment to release the file, and this directory is exactly the
 * one the Sept 15 laptop reset left behind.
 */
const STUBBORN_STATE_ENTRIES: ReadonlySet<string> = new Set(["state"]);

function removeWithRetry(
  target: string,
  outcome: Pick<FactoryResetOutcome, "removed" | "skipped">,
  opts?: { stubborn?: boolean },
): boolean {
  try {
    fs.rmSync(target, {
      recursive: true,
      force: true,
      maxRetries: opts?.stubborn ? 20 : 8,
      retryDelay: opts?.stubborn ? 500 : 250,
    });
    outcome.removed.push(target);
    return true;
  } catch (err) {
    // Windows keeps the gateway's own log file open; skipping it is fine.
    outcome.skipped.push({ path: target, error: err instanceof Error ? err.message : String(err) });
    return false;
  }
}

/**
 * In-process restarts keep this process alive, and with it every file handle
 * the previous gateway instance opened. The shared state database is the one
 * that matters: while it is open, `state/daisyclaw.sqlite` cannot be deleted
 * on Windows (EPERM), and the reset reports "skipped 1" with the old store
 * still there. Close it before touching the disk.
 */
async function closeHandlesHeldAcrossRestart(log?: FactoryResetLogger): Promise<void> {
  try {
    const { closeDaisyClawStateDatabase, isDaisyClawStateDatabaseOpen } =
      await import("../state/daisyclaw-state-db.js");
    if (isDaisyClawStateDatabaseOpen()) {
      closeDaisyClawStateDatabase();
      log?.info("factory reset: closed the shared state database before erasing");
    }
  } catch (err) {
    log?.warn(
      `factory reset: could not close the shared state database: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function resolveResultPath(env: NodeJS.ProcessEnv): string {
  return path.join(resolveStateDir(env), FACTORY_RESET_RESULT_FILENAME);
}

function writeFactoryResetResultSync(
  env: NodeJS.ProcessEnv,
  record: FactoryResetResultRecord,
): void {
  try {
    const target = resolveResultPath(env);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600 });
  } catch {
    // Diagnostics only; never fail the reset over it.
  }
}

/** The last reset's outcome, or null when no reset has been applied on this install. */
export function readFactoryResetResultSync(
  env: NodeJS.ProcessEnv = process.env,
): FactoryResetResultRecord | null {
  let raw: string;
  try {
    raw = fs.readFileSync(resolveResultPath(env), "utf8");
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FactoryResetResultRecord> | null;
    if (!parsed || parsed.kind !== "factory-reset-result") {
      return null;
    }
    return {
      kind: "factory-reset-result",
      appliedAt: typeof parsed.appliedAt === "string" ? parsed.appliedAt : "",
      requestedAt: typeof parsed.requestedAt === "string" ? parsed.requestedAt : "",
      removed: typeof parsed.removed === "number" ? parsed.removed : 0,
      skipped: Array.isArray(parsed.skipped)
        ? parsed.skipped.filter(
            (entry): entry is { path: string; error: string } =>
              typeof entry?.path === "string" && typeof entry?.error === "string",
          )
        : [],
      retries: typeof parsed.retries === "number" ? parsed.retries : 0,
    };
  } catch {
    return null;
  }
}

/**
 * Every gateway start: if the last reset left something behind, try again now
 * that whatever held it is gone. Keeps the result honest so the app can tell
 * the user when the reset is finally complete.
 */
export async function retryFactoryResetLeftovers(params?: {
  env?: NodeJS.ProcessEnv;
  log?: FactoryResetLogger;
}): Promise<FactoryResetResultRecord | null> {
  const env = params?.env ?? process.env;
  const record = readFactoryResetResultSync(env);
  if (!record || record.skipped.length === 0) {
    return record;
  }
  await closeHandlesHeldAcrossRestart(params?.log);
  const stateDir = resolveStateDir(env);
  const home = path.resolve(resolveRequiredHomeDir(env, os.homedir));
  const progress = {
    removed: [] as string[],
    skipped: [] as Array<{ path: string; error: string }>,
  };
  for (const leftover of record.skipped) {
    const resolved = path.resolve(leftover.path);
    if (!isInside(stateDir, resolved) && !isInside(home, resolved)) {
      // Never delete outside the same fence the reset itself uses.
      continue;
    }
    if (!fs.existsSync(resolved)) {
      progress.removed.push(resolved);
      continue;
    }
    removeWithRetry(resolved, progress, {
      stubborn: STUBBORN_STATE_ENTRIES.has(path.basename(resolved)),
    });
  }
  const next: FactoryResetResultRecord = {
    ...record,
    removed: record.removed + progress.removed.length,
    skipped: progress.skipped,
    retries: record.retries + 1,
  };
  writeFactoryResetResultSync(env, next);
  if (progress.removed.length > 0) {
    params?.log?.info(
      `factory reset: removed ${progress.removed.length} leftover entr${progress.removed.length === 1 ? "y" : "ies"} from the last reset` +
        (next.skipped.length > 0 ? `; ${next.skipped.length} still remain` : ""),
    );
  }
  for (const skipped of next.skipped) {
    params?.log?.warn(`factory reset: leftover still present ${skipped.path}: ${skipped.error}`);
  }
  return next;
}

/** Builds the fresh-install config, carrying over only the preserved gateway plumbing. */
export function buildFactoryResetSeedConfig(
  preserve: FactoryResetPreservedGateway,
): DaisyClawConfig {
  const auth: Record<string, unknown> = {};
  if (preserve.authMode) {
    auth.mode = preserve.authMode;
  }
  if (preserve.token) {
    auth.token = preserve.token;
  }
  if (preserve.password) {
    auth.password = preserve.password;
  }
  const gateway: Record<string, unknown> = {};
  if (preserve.mode) {
    gateway.mode = preserve.mode;
  }
  if (preserve.port !== undefined) {
    gateway.port = preserve.port;
  }
  if (preserve.bind) {
    gateway.bind = preserve.bind;
  }
  if (Object.keys(auth).length > 0) {
    gateway.auth = auth;
  }
  return (Object.keys(gateway).length > 0 ? { gateway } : {}) as DaisyClawConfig;
}

/**
 * Applies a pending reset, if any. Safe to call on every gateway start: it is
 * a no-op without a marker. Returns the outcome when a reset was applied.
 */
export async function applyPendingFactoryReset(params?: {
  env?: NodeJS.ProcessEnv;
  log?: FactoryResetLogger;
}): Promise<FactoryResetOutcome | null> {
  const env = params?.env ?? process.env;
  const marker = readPendingFactoryResetMarkerSync(env);
  if (!marker) {
    return null;
  }
  const stateDir = resolveStateDir(env);
  const log = params?.log;
  log?.warn(
    `factory reset: erasing ${stateDir} (requested ${new Date(marker.requestedAt).toISOString()})`,
  );

  const outcome: FactoryResetOutcome = {
    stateDir,
    removed: [],
    skipped: [],
    configPath: "",
    requestedAt: marker.requestedAt,
  };

  await closeHandlesHeldAcrossRestart(log);

  let entries: string[] = [];
  try {
    entries = fs.readdirSync(stateDir);
  } catch (err) {
    log?.warn(
      `factory reset: cannot list ${stateDir}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  for (const entry of entries) {
    if (FACTORY_RESET_PRESERVED_ENTRIES.has(entry)) {
      continue;
    }
    removeWithRetry(path.join(stateDir, entry), outcome, {
      stubborn: STUBBORN_STATE_ENTRIES.has(entry),
    });
  }
  const home = path.resolve(resolveRequiredHomeDir(env, os.homedir));
  for (const workspace of marker.workspaces) {
    const resolved = path.resolve(workspace);
    if (isInside(stateDir, resolved) || !isInside(home, resolved)) {
      // Already covered by the state-dir wipe, or outside the safety fence.
      continue;
    }
    if (fs.existsSync(resolved)) {
      removeWithRetry(resolved, outcome);
    }
  }
  safeUnlink(path.join(stateDir, FACTORY_RESET_MARKER_FILENAME));

  // In-process restarts keep module-level caches alive; drop the ones that
  // would otherwise serve pre-reset data from memory.
  const [{ clearSessionStoreCaches }, { clearRuntimeConfigSnapshot }] = await Promise.all([
    import("../config/sessions/store-cache.js"),
    import("../config/runtime-snapshot.js"),
  ]);
  clearSessionStoreCaches();
  clearRuntimeConfigSnapshot();
  try {
    const { markGatewayModelCatalogStaleForReload } =
      await import("../gateway/server-model-catalog.js");
    markGatewayModelCatalogStaleForReload();
  } catch {
    // Catalog module is optional at this point in startup.
  }

  const [{ buildFirstRunConfig }, { createConfigIO, replaceConfigFile }] = await Promise.all([
    import("../commands/first-run-init.js"),
    import("../config/config.js"),
  ]);
  const io = createConfigIO();
  outcome.configPath = io.configPath;
  const { config } = buildFirstRunConfig(buildFactoryResetSeedConfig(marker.preserve));
  await replaceConfigFile({ nextConfig: config, afterWrite: { mode: "auto" } });

  log?.info(
    `factory reset: done — removed ${outcome.removed.length} entr${outcome.removed.length === 1 ? "y" : "ies"}, ` +
      `skipped ${outcome.skipped.length}, fresh config at ${outcome.configPath}`,
  );
  for (const skipped of outcome.skipped) {
    log?.warn(`factory reset: could not remove ${skipped.path}: ${skipped.error}`);
  }
  writeFactoryResetResultSync(env, {
    kind: "factory-reset-result",
    appliedAt: new Date().toISOString(),
    requestedAt: new Date(marker.requestedAt).toISOString(),
    removed: outcome.removed.length,
    skipped: outcome.skipped,
    retries: 0,
  });
  try {
    fs.mkdirSync(path.join(stateDir, "logs"), { recursive: true });
    fs.appendFileSync(
      path.join(stateDir, "logs", "factory-reset.log"),
      `${JSON.stringify({
        appliedAt: new Date().toISOString(),
        requestedAt: new Date(marker.requestedAt).toISOString(),
        removed: outcome.removed.length,
        skipped: outcome.skipped,
      })}\n`,
    );
  } catch {
    // Diagnostics only.
  }
  return outcome;
}
