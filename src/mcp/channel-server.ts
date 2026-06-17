// Channel MCP server wires channel bridge tools into an MCP server instance.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import { VERSION } from "../version.js";
import { DaisyClawChannelBridge } from "./channel-bridge.js";
import { ClaudePermissionRequestSchema, type ClaudeChannelMode } from "./channel-shared.js";
import { getChannelMcpCapabilities, registerChannelMcpTools } from "./channel-tools.js";

/**
 * MCP stdio server assembly for DaisyClaw channel conversations.
 *
 * This module wires config, the Gateway bridge, protocol notifications, and
 * registered tools into a lifecycle that callers can either embed or serve.
 */
export { DaisyClawChannelBridge } from "./channel-bridge.js";

/** Options accepted by the channel MCP server factory and stdio entry point. */
export type DaisyClawMcpServeOptions = {
  gatewayUrl?: string;
  gatewayToken?: string;
  gatewayPassword?: string;
  config?: DaisyClawConfig;
  claudeChannelMode?: ClaudeChannelMode;
  verbose?: boolean;
};

async function resolveMcpConfig(config: DaisyClawConfig | undefined): Promise<DaisyClawConfig> {
  if (config) {
    return config;
  }
  const { getRuntimeConfig } = await import("../config/config.js");
  return getRuntimeConfig();
}

/** Create an in-process channel MCP server plus explicit start and close hooks. */
export async function createDaisyClawChannelMcpServer(opts: DaisyClawMcpServeOptions = {}): Promise<{
  server: McpServer;
  bridge: DaisyClawChannelBridge;
  start: () => Promise<void>;
  close: () => Promise<void>;
}> {
  const cfg = await resolveMcpConfig(opts.config);
  const claudeChannelMode = opts.claudeChannelMode ?? "auto";
  const capabilities = getChannelMcpCapabilities(claudeChannelMode);
  const server = new McpServer(
    { name: "daisyclaw", version: VERSION },
    capabilities ? { capabilities } : undefined,
  );
  const bridge = new DaisyClawChannelBridge(cfg, {
    gatewayUrl: opts.gatewayUrl,
    gatewayToken: opts.gatewayToken,
    gatewayPassword: opts.gatewayPassword,
    claudeChannelMode,
    verbose: opts.verbose ?? false,
  });
  bridge.setServer(server);

  server.server.setNotificationHandler(ClaudePermissionRequestSchema, async ({ params }) => {
    await bridge.handleClaudePermissionRequest({
      requestId: params.request_id,
      toolName: params.tool_name,
      description: params.description,
      inputPreview: params.input_preview,
    });
  });
  registerChannelMcpTools(server, bridge);

  return {
    server,
    bridge,
    start: async () => {
      await bridge.start();
    },
    close: async () => {
      await bridge.close();
      await server.close();
    },
  };
}

/** Serve the channel MCP server over stdio until transport or process shutdown. */
export async function serveDaisyClawChannelMcp(opts: DaisyClawMcpServeOptions = {}): Promise<void> {
  const { server, start, close } = await createDaisyClawChannelMcpServer(opts);
  const transport = new StdioServerTransport();

  let shuttingDown = false;
  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });

  const shutdown = () => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    process.stdin.off("end", shutdown);
    process.stdin.off("close", shutdown);
    process.off("SIGINT", shutdown);
    process.off("SIGTERM", shutdown);
    // The MCP SDK exposes transport close as a mutable handler rather than an EventEmitter API.
    transport["onclose"] = undefined;
    close().then(resolveClosed, resolveClosed);
  };

  transport["onclose"] = shutdown;
  process.stdin.once("end", shutdown);
  process.stdin.once("close", shutdown);
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  try {
    await server.connect(transport);
    await start();
    await closed;
  } finally {
    shutdown();
    await closed;
  }
}
