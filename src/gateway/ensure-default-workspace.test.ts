import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureDefaultAgentWorkspaceFiles } from "./ensure-default-workspace.js";

const WORKSPACE_FILES = [
  "AGENTS.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "MEMORY.md",
  "SOUL.md",
];

describe("ensureDefaultAgentWorkspaceFiles", () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("creates every workspace file the Files panel lists, on a consumer build", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daisyclaw-default-ws-"));
    const workspace = path.join(tempDir, "workspace");
    const infos: string[] = [];

    const result = await ensureDefaultAgentWorkspaceFiles({
      cfg: { agents: { defaults: { workspace } } } as never,
      consumerLockdown: true,
      log: { info: (m) => infos.push(m), warn: () => undefined },
    });

    expect(result.status).toBe("ok");
    for (const name of WORKSPACE_FILES) {
      await expect(fs.stat(path.join(workspace, name)), name).resolves.toBeTruthy();
    }
    expect(infos.join("\n")).toContain('workspace ready for agent "main"');
  });

  it("never overwrites files the user already has", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daisyclaw-default-ws-"));
    const workspace = path.join(tempDir, "workspace");
    await fs.mkdir(workspace, { recursive: true });
    await fs.writeFile(path.join(workspace, "USER.md"), "# Me\nI like tea.\n");

    await ensureDefaultAgentWorkspaceFiles({
      cfg: { agents: { defaults: { workspace } } } as never,
      consumerLockdown: true,
    });

    await expect(fs.readFile(path.join(workspace, "USER.md"), "utf8")).resolves.toBe(
      "# Me\nI like tea.\n",
    );
    await expect(fs.stat(path.join(workspace, "AGENTS.md"))).resolves.toBeTruthy();
  });

  it("does nothing on a developer install", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daisyclaw-default-ws-"));
    const workspace = path.join(tempDir, "workspace");

    const result = await ensureDefaultAgentWorkspaceFiles({
      cfg: { agents: { defaults: { workspace } } } as never,
      consumerLockdown: false,
    });

    expect(result).toEqual({ status: "skipped", reason: "not-consumer" });
    await expect(fs.stat(workspace)).rejects.toThrow();
  });
});
