// Process-local MCP loopback runtime state for owner/non-owner HTTP access.
type McpLoopbackRuntime = {
  port: number;
  ownerToken: string;
  nonOwnerToken: string;
};

let activeRuntime: McpLoopbackRuntime | undefined;

/** Return a copy of the active loopback runtime, if one has been installed. */
export function getActiveMcpLoopbackRuntime(): McpLoopbackRuntime | undefined {
  return activeRuntime ? { ...activeRuntime } : undefined;
}

/** Install the active loopback runtime used by in-process MCP callers. */
export function setActiveMcpLoopbackRuntime(runtime: McpLoopbackRuntime): void {
  activeRuntime = { ...runtime };
}

/** Choose the bearer token matching owner/non-owner caller identity. */
export function resolveMcpLoopbackBearerToken(
  runtime: McpLoopbackRuntime,
  senderIsOwner: boolean,
): string {
  return senderIsOwner ? runtime.ownerToken : runtime.nonOwnerToken;
}

/** Clear loopback runtime only when the owning token matches the active runtime. */
export function clearActiveMcpLoopbackRuntimeByOwnerToken(ownerToken: string): void {
  if (activeRuntime?.ownerToken === ownerToken) {
    activeRuntime = undefined;
  }
}

/** Build the MCP server config injected into agents for loopback tool access. */
export function createMcpLoopbackServerConfig(port: number) {
  return {
    mcpServers: {
      daisyclaw: {
        type: "http",
        url: `http://127.0.0.1:${port}/mcp`,
        headers: {
          Authorization: "Bearer ${DAISYCLAW_MCP_TOKEN}",
          "x-session-key": "${DAISYCLAW_MCP_SESSION_KEY}",
          "x-daisyclaw-agent-id": "${DAISYCLAW_MCP_AGENT_ID}",
          "x-daisyclaw-account-id": "${DAISYCLAW_MCP_ACCOUNT_ID}",
          "x-daisyclaw-message-channel": "${DAISYCLAW_MCP_MESSAGE_CHANNEL}",
          "x-daisyclaw-current-channel-id": "${DAISYCLAW_MCP_CURRENT_CHANNEL_ID}",
          "x-daisyclaw-current-thread-ts": "${DAISYCLAW_MCP_CURRENT_THREAD_TS}",
          "x-daisyclaw-current-message-id": "${DAISYCLAW_MCP_CURRENT_MESSAGE_ID}",
          "x-daisyclaw-current-inbound-audio": "${DAISYCLAW_MCP_CURRENT_INBOUND_AUDIO}",
          "x-daisyclaw-inbound-event-kind": "${DAISYCLAW_MCP_INBOUND_EVENT_KIND}",
          "x-daisyclaw-source-reply-delivery-mode": "${DAISYCLAW_MCP_SOURCE_REPLY_DELIVERY_MODE}",
        },
      },
    },
  };
}
