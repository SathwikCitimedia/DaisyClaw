/**
 * Standalone MCP server for selected built-in DaisyClaw tools.
 *
 * Run via: node --import tsx src/mcp/daisyclaw-tools-serve.ts
 * Or: bun src/mcp/daisyclaw-tools-serve.ts
 */
import { pathToFileURL } from "node:url";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AnyAgentTool } from "../agents/tools/common.js";
import { createCronTool } from "../agents/tools/cron-tool.js";
import { formatErrorMessage } from "../infra/errors.js";
import { connectToolsMcpServerToStdio, createToolsMcpServer } from "./tools-stdio-server.js";

export function resolveDaisyClawToolsForMcp(): AnyAgentTool[] {
  return [createCronTool()];
}

function createDaisyClawToolsMcpServer(
  params: {
    tools?: AnyAgentTool[];
  } = {},
): Server {
  const tools = params.tools ?? resolveDaisyClawToolsForMcp();
  return createToolsMcpServer({ name: "daisyclaw-tools", tools });
}

async function serveDaisyClawToolsMcp(): Promise<void> {
  const server = createDaisyClawToolsMcpServer();
  await connectToolsMcpServerToStdio(server);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  serveDaisyClawToolsMcp().catch((err: unknown) => {
    process.stderr.write(`daisyclaw-tools-serve: ${formatErrorMessage(err)}\n`);
    process.exit(1);
  });
}
