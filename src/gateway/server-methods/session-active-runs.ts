// Session active-run helpers decide whether session operations should treat a
// session as busy based on Control UI-visible active chat/agent runs.
import { normalizeAgentId } from "../../routing/session-key.js";
import type { GatewayRequestContext } from "./types.js";

/**
 * Active-run matcher used by session list/update methods.
 *
 * It only reports runs visible to the Control UI so background or hidden runs
 * do not make a session look busy to user-facing session operations.
 */
type TrackedActiveSessionRun = {
  sessionKey: string;
  agentId?: string;
  startedAtMs?: number;
};

function collectTrackedActiveSessionRuns(
  context: Partial<Pick<GatewayRequestContext, "chatAbortControllers">>,
): TrackedActiveSessionRun[] {
  const runs: TrackedActiveSessionRun[] = [];
  if (!(context.chatAbortControllers instanceof Map)) {
    return runs;
  }
  for (const active of context.chatAbortControllers.values()) {
    if (
      active.projectSessionActive !== false &&
      active.controlUiVisible !== false &&
      typeof active.sessionKey === "string" &&
      active.sessionKey.trim()
    ) {
      runs.push({
        sessionKey: active.sessionKey,
        agentId: typeof active.agentId === "string" ? normalizeAgentId(active.agentId) : undefined,
        ...(typeof active.startedAtMs === "number" && Number.isFinite(active.startedAtMs)
          ? { startedAtMs: active.startedAtMs }
          : {}),
      });
    }
  }
  return runs;
}

function isTrackedActiveSessionRunForKey(
  active: TrackedActiveSessionRun,
  key: string,
  agentId?: string,
  defaultAgentId?: string,
): boolean {
  if (active.sessionKey !== key) {
    return false;
  }
  if (key !== "global") {
    return true;
  }
  const requestedAgentId = agentId ?? defaultAgentId;
  if (!requestedAgentId) {
    return true;
  }
  const activeAgentId = active.agentId ?? defaultAgentId;
  return activeAgentId
    ? normalizeAgentId(activeAgentId) === normalizeAgentId(requestedAgentId)
    : false;
}

type TrackedActiveSessionRunParams = {
  context: Partial<Pick<GatewayRequestContext, "chatAbortControllers">>;
  requestedKey: string;
  canonicalKey: string;
  agentId?: string;
  defaultAgentId?: string;
};

function findTrackedActiveSessionRuns(
  params: TrackedActiveSessionRunParams,
): TrackedActiveSessionRun[] {
  return collectTrackedActiveSessionRuns(params.context).filter(
    (active) =>
      isTrackedActiveSessionRunForKey(
        active,
        params.canonicalKey,
        params.agentId,
        params.defaultAgentId,
      ) ||
      isTrackedActiveSessionRunForKey(
        active,
        params.requestedKey,
        params.agentId,
        params.defaultAgentId,
      ),
  );
}

/** Returns true when either requested or canonical session key has a visible active run. */
export function hasTrackedActiveSessionRun(params: TrackedActiveSessionRunParams): boolean {
  return findTrackedActiveSessionRuns(params).length > 0;
}

type SessionRunFields = {
  status?: string;
  startedAt?: number;
  endedAt?: number;
  runtimeMs?: number;
  hasActiveRun?: boolean;
};

/**
 * Adds the live-run flag to a session row, and keeps the row's status from
 * contradicting it.
 *
 * A row's status is saved when a run's lifecycle events are written, a beat
 * after the run starts. Until then a new run's row still carries the previous
 * run's "done", and clients rightly trust a finished status over the live flag
 * (the flag outlives a run briefly). So a finished status older than the run in
 * flight is reported as the running status the lifecycle is about to write.
 */
export function withTrackedActiveSessionRun<T extends SessionRunFields>(
  row: T,
  params: TrackedActiveSessionRunParams,
): T & { hasActiveRun: boolean } {
  const runs = findTrackedActiveSessionRuns(params);
  if (runs.length === 0) {
    return { ...row, hasActiveRun: false };
  }
  const startedAtMs = runs.reduce<number | undefined>(
    (latest, run) =>
      run.startedAtMs !== undefined && (latest === undefined || run.startedAtMs > latest)
        ? run.startedAtMs
        : latest,
    undefined,
  );
  const finishedEarlier =
    row.status !== undefined &&
    row.status !== "running" &&
    startedAtMs !== undefined &&
    (row.endedAt === undefined || row.endedAt <= startedAtMs);
  if (!finishedEarlier) {
    return { ...row, hasActiveRun: true };
  }
  return {
    ...row,
    hasActiveRun: true,
    status: "running",
    startedAt: startedAtMs,
    endedAt: undefined,
    runtimeMs: undefined,
  };
}
