/**
 * Seeds the default agent's workspace files when the gateway starts.
 *
 * The workspace (AGENTS.md, TOOLS.md, IDENTITY.md, USER.md, HEARTBEAT.md,
 * BOOTSTRAP.md, MEMORY.md and the locked SOUL.md) was only ever created on
 * the first agent run or by the terminal setup command. A consumer install
 * has neither before the first chat, so the Files panel showed every file as
 * "Missing" on a fresh install and again after a reset. The packaged product
 * has no terminal to fix that from, so the gateway does it itself.
 *
 * Runs only under the consumer lockdown: dev installs keep full control over
 * their workspace contents.
 */
import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope-config.js";
import { ensureAgentWorkspace } from "../agents/workspace.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { isConsumerLockdownActive } from "../infra/consumer-lockdown.js";
import { formatErrorMessage } from "../infra/errors.js";

export type EnsureDefaultWorkspaceLogger = {
  info: (message: string) => void;
  warn: (message: string) => void;
};

export type EnsureDefaultWorkspaceResult =
  | { status: "skipped"; reason: "not-consumer" }
  | { status: "ok"; agentId: string; dir: string }
  | { status: "failed"; agentId: string; dir: string; error: string };

export async function ensureDefaultAgentWorkspaceFiles(params: {
  cfg: DaisyClawConfig;
  log?: EnsureDefaultWorkspaceLogger;
  env?: NodeJS.ProcessEnv;
  /** Test seam; defaults to the real lockdown flag. */
  consumerLockdown?: boolean;
}): Promise<EnsureDefaultWorkspaceResult> {
  const env = params.env ?? process.env;
  const lockdown = params.consumerLockdown ?? isConsumerLockdownActive(env);
  if (!lockdown) {
    return { status: "skipped", reason: "not-consumer" };
  }
  const agentId = resolveDefaultAgentId(params.cfg);
  const dir = resolveAgentWorkspaceDir(params.cfg, agentId, env);
  try {
    // ensureBootstrapFiles writes only what is missing, so an existing
    // workspace (and anything the user edited) is left exactly as it was.
    const workspace = await ensureAgentWorkspace({ dir, ensureBootstrapFiles: true });
    params.log?.info(`workspace ready for agent "${agentId}" at ${workspace.dir}`);
    return { status: "ok", agentId, dir: workspace.dir };
  } catch (err) {
    const error = formatErrorMessage(err);
    params.log?.warn(`workspace setup for agent "${agentId}" at ${dir} failed: ${error}`);
    return { status: "failed", agentId, dir, error };
  }
}
