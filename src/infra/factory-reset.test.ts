import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { withDaisyClawTestState } from "../test-utils/daisyclaw-test-state.js";
import {
  applyPendingFactoryReset,
  buildFactoryResetSeedConfig,
  collectFactoryResetWorkspaces,
  FACTORY_RESET_MARKER_FILENAME,
  readPendingFactoryResetMarkerSync,
  writeFactoryResetMarkerSync,
} from "./factory-reset.js";

function readJson5Config(configPath: string): Record<string, unknown> {
  const raw = fs.readFileSync(configPath, "utf8").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(raw) as Record<string, unknown>;
}

describe("factory reset", () => {
  it("erases user data, keeps the app↔engine plumbing, and reseeds a first-run config", async () => {
    await withDaisyClawTestState(
      { applyEnv: true, gateway: { port: 18999, token: "keep-this-token" } },
      async (state) => {
        const cfg = {
          gateway: {
            mode: "local",
            port: 18999,
            auth: { mode: "token", token: "keep-this-token" },
          },
          models: {
            providers: { litellm: { baseUrl: "http://10.0.0.1:4000/v1", apiKey: "sk-x" } },
          },
          agents: { defaults: { model: "litellm/claude-sonnet-4-5" } },
        };
        await state.writeConfig(cfg);
        await state.writeText("credentials/whatsapp/creds.json", "{}");
        await state.writeText("agents/main/sessions/sessions.json", "{}");
        await state.writeText("memory/main.sqlite", "x");
        await state.writeText(".env", "OPENAI_API_KEY=secret");
        await state.writeText("gateway.cmd", "@echo off");
        await state.writeText("identity/device.json", "{}");
        await state.writeText("devices/paired.json", "{}");
        // Default workspace lives under the home dir and is erased; a workspace
        // outside the home dir (the test harness's own) is behind the safety fence.
        const defaultWorkspace = path.join(state.home, ".daisyclaw", "workspace");
        fs.mkdirSync(defaultWorkspace, { recursive: true });
        fs.writeFileSync(path.join(defaultWorkspace, "MEMORY.md"), "remember me");
        fs.mkdirSync(state.workspaceDir, { recursive: true });
        fs.writeFileSync(path.join(state.workspaceDir, "OUTSIDE.md"), "not ours to delete");

        const marker = writeFactoryResetMarkerSync({ cfg: cfg as never, env: state.env });
        expect(marker.preserve).toEqual({
          mode: "local",
          port: 18999,
          authMode: "token",
          token: "keep-this-token",
        });
        expect(fs.existsSync(state.statePath(FACTORY_RESET_MARKER_FILENAME))).toBe(true);
        expect(readPendingFactoryResetMarkerSync(state.env)?.requestedAt).toBe(marker.requestedAt);

        const outcome = await applyPendingFactoryReset({ env: state.env });
        expect(outcome).not.toBeNull();
        expect(outcome?.skipped).toEqual([]);

        // User content is gone.
        for (const gone of [
          "credentials",
          "agents",
          "memory",
          ".env",
          FACTORY_RESET_MARKER_FILENAME,
        ]) {
          expect(fs.existsSync(state.statePath(gone)), gone).toBe(false);
        }
        expect(fs.existsSync(path.join(defaultWorkspace, "MEMORY.md"))).toBe(false);
        expect(fs.existsSync(path.join(state.workspaceDir, "OUTSIDE.md"))).toBe(true);

        // Plumbing survives.
        for (const kept of ["gateway.cmd", "identity/device.json", "devices/paired.json"]) {
          expect(fs.existsSync(state.statePath(kept)), kept).toBe(true);
        }

        // Fresh config: same token and port, no providers, skill pack applied.
        const next = readJson5Config(state.configPath);
        const gateway = next.gateway as Record<string, unknown>;
        expect(gateway.port).toBe(18999);
        expect(gateway.mode).toBe("local");
        expect((gateway.auth as Record<string, unknown>).token).toBe("keep-this-token");
        expect((next.models as Record<string, unknown> | undefined)?.providers).toBeUndefined();
        expect(
          (
            (next.agents as Record<string, unknown> | undefined)?.defaults as
              | Record<string, unknown>
              | undefined
          )?.model,
        ).toBeUndefined();
        expect(next.skills).toBeDefined();

        // Second call is a no-op.
        expect(await applyPendingFactoryReset({ env: state.env })).toBeNull();
      },
    );
  });

  it("ignores and removes a stale marker instead of wiping", async () => {
    await withDaisyClawTestState({ applyEnv: true }, async (state) => {
      await state.writeConfig({ gateway: { mode: "local" } });
      await state.writeText("memory/keep.sqlite", "x");
      writeFactoryResetMarkerSync({
        cfg: {} as never,
        env: state.env,
        now: Date.now() - 2 * 60 * 60_000,
      });
      expect(readPendingFactoryResetMarkerSync(state.env)).toBeNull();
      expect(fs.existsSync(state.statePath(FACTORY_RESET_MARKER_FILENAME))).toBe(false);
      expect(await applyPendingFactoryReset({ env: state.env })).toBeNull();
      expect(fs.existsSync(state.statePath("memory/keep.sqlite"))).toBe(true);
    });
  });

  it("ignores a corrupt marker", async () => {
    await withDaisyClawTestState({ applyEnv: true }, async (state) => {
      await state.writeText(FACTORY_RESET_MARKER_FILENAME, "{not json");
      expect(readPendingFactoryResetMarkerSync(state.env)).toBeNull();
      expect(fs.existsSync(state.statePath(FACTORY_RESET_MARKER_FILENAME))).toBe(false);
    });
  });

  it("only deletes workspaces inside the home directory", () => {
    const home = path.resolve("/home/daisy");
    const env = { HOME: home, USERPROFILE: home } as NodeJS.ProcessEnv;
    const workspaces = collectFactoryResetWorkspaces(
      {
        agents: {
          defaults: { workspace: "~/projects/daisy-workspace" },
          list: [
            { id: "x", workspace: "/etc" },
            { id: "y", workspace: "~" },
          ],
        },
      } as never,
      env,
      () => home,
    );
    expect(workspaces).toContain(path.join(home, ".daisyclaw", "workspace"));
    expect(workspaces).toContain(path.join(home, "projects", "daisy-workspace"));
    expect(workspaces.some((entry) => entry === home)).toBe(false);
    expect(workspaces.some((entry) => entry === path.resolve("/etc"))).toBe(false);
  });

  it("builds a seed config from only the preserved fields", () => {
    expect(buildFactoryResetSeedConfig({})).toEqual({});
    expect(buildFactoryResetSeedConfig({ token: "t", port: 1 })).toEqual({
      gateway: { port: 1, auth: { token: "t" } },
    });
  });
});
