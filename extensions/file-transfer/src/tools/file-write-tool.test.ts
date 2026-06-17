// File Transfer tests cover file write tool plugin behavior.
import { callGatewayTool } from "daisyclaw/plugin-sdk/agent-harness-runtime";
import { describe, expect, it, vi } from "vitest";
import { createFileWriteTool } from "./file-write-tool.js";

vi.mock("daisyclaw/plugin-sdk/agent-harness-runtime", () => ({
  callGatewayTool: vi.fn(),
  listNodes: vi.fn(),
  resolveNodeIdFromList: vi.fn(),
}));

vi.mock("daisyclaw/plugin-sdk/media-store", () => ({
  readMediaBuffer: vi.fn(),
}));

describe("file_write tool", () => {
  it("rejects malformed inline base64 before invoking the node", async () => {
    const tool = createFileWriteTool();

    await expect(
      tool.execute("tool-call-1", {
        node: "node-1",
        path: "/tmp/out.txt",
        contentBase64: "AAA@@@",
      }),
    ).rejects.toThrow("contentBase64 is not valid base64");

    expect(callGatewayTool).not.toHaveBeenCalled();
  });
});
