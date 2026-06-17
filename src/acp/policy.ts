/** Policy gates for ACP availability, dispatch, and allowed agent ids. */
import { AcpRuntimeError } from "@daisyclaw/acp-core/runtime/errors";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { normalizeAgentId } from "../routing/session-key.js";

const ACP_DISABLED_MESSAGE = "ACP is disabled by policy (`acp.enabled=false`).";
const ACP_DISPATCH_DISABLED_MESSAGE =
  "ACP dispatch is disabled by policy (`acp.dispatch.enabled=false`).";

export type AcpDispatchPolicyState = "enabled" | "acp_disabled" | "dispatch_disabled";

/** Returns whether ACP is globally enabled by config policy. */
export function isAcpEnabledByPolicy(cfg: DaisyClawConfig): boolean {
  return cfg.acp?.enabled !== false;
}

/** Resolves the effective dispatch policy state for inbound ACP routing. */
export function resolveAcpDispatchPolicyState(cfg: DaisyClawConfig): AcpDispatchPolicyState {
  if (!isAcpEnabledByPolicy(cfg)) {
    return "acp_disabled";
  }
  // ACP dispatch is enabled unless explicitly disabled.
  if (cfg.acp?.dispatch?.enabled === false) {
    return "dispatch_disabled";
  }
  return "enabled";
}

/** Returns whether inbound ACP dispatch is currently allowed. */
export function isAcpDispatchEnabledByPolicy(cfg: DaisyClawConfig): boolean {
  return resolveAcpDispatchPolicyState(cfg) === "enabled";
}

/** Returns the operator-facing dispatch block message, if any. */
export function resolveAcpDispatchPolicyMessage(cfg: DaisyClawConfig): string | null {
  const state = resolveAcpDispatchPolicyState(cfg);
  if (state === "acp_disabled") {
    return ACP_DISABLED_MESSAGE;
  }
  if (state === "dispatch_disabled") {
    return ACP_DISPATCH_DISABLED_MESSAGE;
  }
  return null;
}

/** Returns the runtime error for dispatch-blocked ACP routing, if blocked. */
export function resolveAcpDispatchPolicyError(cfg: DaisyClawConfig): AcpRuntimeError | null {
  const message = resolveAcpDispatchPolicyMessage(cfg);
  if (!message) {
    return null;
  }
  return new AcpRuntimeError("ACP_DISPATCH_DISABLED", message);
}

/** Returns the runtime error for explicit ACP turns when ACP itself is disabled. */
export function resolveAcpExplicitTurnPolicyError(cfg: DaisyClawConfig): AcpRuntimeError | null {
  if (isAcpEnabledByPolicy(cfg)) {
    return null;
  }
  return new AcpRuntimeError("ACP_DISPATCH_DISABLED", ACP_DISABLED_MESSAGE);
}

/** Returns whether an agent id passes the optional ACP allowed-agent list. */
export function isAcpAgentAllowedByPolicy(cfg: DaisyClawConfig, agentId: string): boolean {
  const allowed = (cfg.acp?.allowedAgents ?? [])
    .map((entry) => normalizeAgentId(entry))
    .filter(Boolean);
  if (allowed.length === 0) {
    return true;
  }
  return allowed.includes(normalizeAgentId(agentId));
}

/** Returns the runtime error for agent-policy rejection, if rejected. */
export function resolveAcpAgentPolicyError(
  cfg: DaisyClawConfig,
  agentId: string,
): AcpRuntimeError | null {
  if (isAcpAgentAllowedByPolicy(cfg, agentId)) {
    return null;
  }
  return new AcpRuntimeError(
    "ACP_SESSION_INIT_FAILED",
    `ACP agent "${normalizeAgentId(agentId)}" is not allowed by policy.`,
  );
}
