// DaisyClaw MCP tools tests cover core tool server startup and registration.
import { describe, expect, it } from "vitest";
import { resolveDaisyClawToolsForMcp } from "./daisyclaw-tools-serve.js";
import { createPluginToolsMcpHandlers } from "./plugin-tools-handlers.js";

describe("DaisyClaw tools MCP server", () => {
  it("exposes cron", async () => {
    const handlers = createPluginToolsMcpHandlers(resolveDaisyClawToolsForMcp());

    const listed = await handlers.listTools();
    expect(listed.tools.map((tool) => tool.name)).toContain("cron");
  });
});
