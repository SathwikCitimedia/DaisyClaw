// Agent database path helpers resolve per-agent persisted database paths.
import path from "node:path";
import { normalizeAgentId } from "../routing/session-key.js";
import { resolveDaisyClawStateSqliteDir } from "./daisyclaw-state-db.paths.js";

/**
 * Path helpers for per-agent SQLite state.
 *
 * Agent databases live beside the shared state database root so each agent can
 * own private runtime tables while the shared registry can still discover them.
 */
/** Inputs for resolving one agent SQLite path or directory. */
export type DaisyClawAgentSqlitePathOptions = {
  agentId: string;
  env?: NodeJS.ProcessEnv;
  path?: string;
};

/** Resolve the SQLite file for one normalized agent id. */
export function resolveDaisyClawAgentSqlitePath(options: DaisyClawAgentSqlitePathOptions): string {
  const agentId = normalizeAgentId(options.agentId);
  return (
    options.path ??
    path.join(
      path.dirname(resolveDaisyClawStateSqliteDir(options.env ?? process.env)),
      "agents",
      agentId,
      "agent",
      "daisyclaw-agent.sqlite",
    )
  );
}

/** Resolve the containing directory for one agent's SQLite database. */
export function resolveDaisyClawAgentSqliteDir(options: DaisyClawAgentSqlitePathOptions): string {
  return path.dirname(resolveDaisyClawAgentSqlitePath(options));
}
