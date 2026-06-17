// Matrix plugin module implements exec approval resolver behavior.
import { resolveApprovalOverGateway } from "daisyclaw/plugin-sdk/approval-gateway-runtime";
import type { ExecApprovalReplyDecision } from "daisyclaw/plugin-sdk/approval-runtime";
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";
import { isApprovalNotFoundError } from "daisyclaw/plugin-sdk/error-runtime";

export { isApprovalNotFoundError };

export async function resolveMatrixApproval(params: {
  cfg: DaisyClawConfig;
  approvalId: string;
  decision: ExecApprovalReplyDecision;
  senderId?: string | null;
  gatewayUrl?: string;
}): Promise<void> {
  await resolveApprovalOverGateway({
    cfg: params.cfg,
    approvalId: params.approvalId,
    decision: params.decision,
    senderId: params.senderId,
    gatewayUrl: params.gatewayUrl,
    clientDisplayName: `Matrix approval (${params.senderId?.trim() || "unknown"})`,
  });
}
