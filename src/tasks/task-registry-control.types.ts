// Defines task control runtime contracts exposed to command surfaces.
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";

/** Admin cancellation hook for ACP sessions owned by task records. */
export type CancelAcpSessionAdmin = (params: {
  cfg: DaisyClawConfig;
  sessionKey: string;
  reason: string;
}) => Promise<void>;

export type KillSubagentRunAdminResult = {
  found: boolean;
  killed: boolean;
  runId?: string;
  sessionKey?: string;
  cascadeKilled?: number;
  cascadeLabels?: string[];
};

export type KillSubagentRunAdmin = (params: {
  cfg: DaisyClawConfig;
  sessionKey: string;
}) => Promise<KillSubagentRunAdminResult>;

export type TaskRegistryControlRuntime = {
  getAcpSessionManager: () => {
    cancelSession: CancelAcpSessionAdmin;
  };
  killSubagentRunAdmin: KillSubagentRunAdmin;
};
