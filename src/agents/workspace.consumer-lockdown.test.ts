// Consumer lockdown seeds fresh workspaces with the production persona instead
// of the dev SOUL template. Lives in its own file so the module-level template
// cache is never pre-warmed with dev content by neighboring tests.
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SOUL_FILENAME, ensureAgentWorkspace } from "./workspace.js";

describe("ensureAgentWorkspace under consumer lockdown", () => {
  let tempDir: string | undefined;

  beforeAll(() => {
    process.env.DAISYCLAW_CONSUMER_LOCKDOWN = "1";
  });

  afterAll(async () => {
    delete process.env.DAISYCLAW_CONSUMER_LOCKDOWN;
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it("seeds SOUL.md from the production persona", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "daisyclaw-lockdown-ws-"));

    await ensureAgentWorkspace({ dir: tempDir, ensureBootstrapFiles: true });

    const soul = await fs.readFile(path.join(tempDir, DEFAULT_SOUL_FILENAME), "utf-8");
    // Production persona marker (src/agents/templates/production-soul.md).
    expect(soul).toContain("You're their friend.");
    // Dev template marker (docs/reference/templates/SOUL.md) must not leak in.
    expect(soul).not.toContain("You're becoming someone.");
  });
});
