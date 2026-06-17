// Whatsapp plugin module implements message line behavior.
import type { DaisyClawConfig } from "daisyclaw/plugin-sdk/config-contracts";

export {
  formatInboundEnvelope,
  type EnvelopeFormatOptions,
} from "daisyclaw/plugin-sdk/channel-inbound";

type WhatsAppMessagePrefixConfig = DaisyClawConfig;

function normalizeAgentId(agentId: string): string {
  return agentId.trim().toLowerCase() || "main";
}

function resolveIdentityNamePrefix(
  cfg: WhatsAppMessagePrefixConfig,
  agentId: string,
): string | undefined {
  const normalizedAgentId = normalizeAgentId(agentId);
  const identityName = cfg.agents?.list
    ?.find((agent) => normalizeAgentId(agent.id ?? "") === normalizedAgentId)
    ?.identity?.name?.trim();
  return identityName ? `[${identityName}]` : undefined;
}

export function resolveMessagePrefix(
  cfg: WhatsAppMessagePrefixConfig,
  agentId: string,
  opts?: { configured?: string; hasAllowFrom?: boolean; fallback?: string },
): string {
  const configured = opts?.configured ?? cfg.messages?.messagePrefix;
  if (configured !== undefined) {
    return configured;
  }
  if (opts?.hasAllowFrom === true) {
    return "";
  }
  return resolveIdentityNamePrefix(cfg, agentId) ?? opts?.fallback ?? "[daisyclaw]";
}
