// Setup command tests cover local setup initialization and next-step messaging.
import fs from "node:fs/promises";
import path from "node:path";
import { withTempHome } from "daisyclaw/plugin-sdk/test-env";
import { describe, expect, it, vi } from "vitest";
import { setupCommand } from "./setup.js";

function createSetupDeps(home: string) {
  const configPath = path.join(home, ".daisyclaw", "daisyclaw.json");
  return {
    createConfigIO: () => ({ configPath }),
    ensureAgentWorkspace: vi.fn(
      async (params?: { dir?: string; skipOptionalBootstrapFiles?: string[] }) => ({
        dir: params?.dir ?? path.join(home, ".daisyclaw", "workspace"),
      }),
    ),
    formatConfigPath: (value: string) => value,
    logConfigUpdated: vi.fn(
      (runtime: { log: (message: string) => void }, opts: { path?: string; suffix?: string }) => {
        const suffix = opts.suffix ? ` ${opts.suffix}` : "";
        runtime.log(`Updated ${opts.path}${suffix}`);
      },
    ),
    mkdir: vi.fn(async () => {}),
    resolveSessionTranscriptsDir: vi.fn(() => path.join(home, ".daisyclaw", "sessions")),
    replaceConfigFile: vi.fn(async ({ nextConfig }: { nextConfig: unknown }) => {
      await fs.mkdir(path.dirname(configPath), { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(nextConfig, null, 2));
    }),
  };
}

function requireFirstWorkspaceParams(
  ensureAgentWorkspace: ReturnType<typeof vi.fn>,
): Record<string, unknown> {
  const [call] = ensureAgentWorkspace.mock.calls;
  if (!call) {
    throw new Error("expected workspace setup call");
  }
  const [params] = call;
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw new Error("expected workspace setup params");
  }
  return params as Record<string, unknown>;
}

describe("setupCommand", () => {
  it("writes gateway.mode=local on first run", async () => {
    await withTempHome(async (home) => {
      const runtime = {
        log: vi.fn(),
        error: vi.fn(),
        exit: vi.fn(),
      };
      const deps = createSetupDeps(home);
      const workspace = path.join(home, ".daisyclaw", "workspace");

      await setupCommand({ workspace }, runtime, deps);

      const configPath = path.join(home, ".daisyclaw", "daisyclaw.json");
      const raw = JSON.parse(await fs.readFile(configPath, "utf-8")) as {
        agents?: { defaults?: { workspace?: string } };
        gateway?: { mode?: string; auth?: { token?: string } };
        skills?: { entries?: Record<string, { enabled?: boolean }> };
      };

      expect(raw.agents?.defaults?.workspace).toBe(workspace);
      expect(raw.gateway?.mode).toBe("local");
      // Fresh installs must be reachable from the Control UI: a generated
      // token, and the curated starter pack instead of the full dev catalog.
      expect(typeof raw.gateway?.auth?.token).toBe("string");
      expect(raw.gateway?.auth?.token?.length ?? 0).toBeGreaterThan(0);
      const hiddenEntries = Object.values(raw.skills?.entries ?? {}).filter(
        (entry) => entry.enabled === false,
      );
      expect(hiddenEntries.length).toBeGreaterThan(0);
    });
  });

  it("explains that plain setup only initializes local files", async () => {
    await withTempHome(async (home) => {
      const runtime = {
        log: vi.fn(),
        error: vi.fn(),
        exit: vi.fn(),
      };
      const deps = createSetupDeps(home);

      await setupCommand(undefined, runtime, deps);

      expect(runtime.log.mock.calls.map((call) => String(call[0])).slice(-5)).toStrictEqual([
        "",
        "Setup complete: config, workspace, and session directories are ready.",
        "Next guided path: daisyclaw onboard.",
        "Next targeted changes: daisyclaw configure for models, channels, Gateway, plugins, skills, and health checks.",
        "Add a chat channel later: daisyclaw channels add.",
      ]);
    });
  });

  it("adds gateway.mode=local to an existing config without overwriting workspace", async () => {
    await withTempHome(async (home) => {
      const runtime = {
        log: vi.fn(),
        error: vi.fn(),
        exit: vi.fn(),
      };
      const configDir = path.join(home, ".daisyclaw");
      const configPath = path.join(configDir, "daisyclaw.json");
      const workspace = path.join(home, "custom-workspace");
      const deps = createSetupDeps(home);

      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: {
            defaults: {
              workspace,
            },
          },
        }),
      );

      await setupCommand(undefined, runtime, deps);

      const raw = JSON.parse(await fs.readFile(configPath, "utf-8")) as {
        agents?: { defaults?: { workspace?: string } };
        gateway?: { mode?: string; auth?: { token?: string } };
        skills?: { entries?: Record<string, { enabled?: boolean }> };
      };

      expect(raw.agents?.defaults?.workspace).toBe(workspace);
      expect(raw.gateway?.mode).toBe("local");
      // Existing installs with no auth get a token (they were unreachable
      // from the Control UI without one) but keep their skill visibility.
      expect(typeof raw.gateway?.auth?.token).toBe("string");
      expect(raw.skills).toBeUndefined();
    });
  });

  it("keeps existing auth untouched and generates nothing", async () => {
    await withTempHome(async (home) => {
      const runtime = {
        log: vi.fn(),
        error: vi.fn(),
        exit: vi.fn(),
      };
      const configDir = path.join(home, ".daisyclaw");
      const configPath = path.join(configDir, "daisyclaw.json");
      const deps = createSetupDeps(home);

      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify({
          gateway: { mode: "local", auth: { token: "user-token" } },
          agents: { defaults: { workspace: path.join(home, "ws") } },
        }),
      );

      await setupCommand(undefined, runtime, deps);

      const raw = JSON.parse(await fs.readFile(configPath, "utf-8").catch(() => "null")) as {
        gateway?: { auth?: { token?: string } };
      } | null;

      // No rewrite was needed, or if rewritten, the token is preserved.
      if (raw) {
        expect(raw.gateway?.auth?.token ?? "user-token").toBe("user-token");
      }
      expect(deps.replaceConfigFile).not.toHaveBeenCalled();
    });
  });

  it("threads skipOptionalBootstrapFiles into workspace creation", async () => {
    await withTempHome(async (home) => {
      const runtime = {
        log: vi.fn(),
        error: vi.fn(),
        exit: vi.fn(),
      };
      const configDir = path.join(home, ".daisyclaw");
      const configPath = path.join(configDir, "daisyclaw.json");
      const deps = createSetupDeps(home);
      const workspace = path.join(home, "custom-workspace");

      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(
        configPath,
        JSON.stringify({
          agents: {
            defaults: {
              workspace,
              skipOptionalBootstrapFiles: ["IDENTITY.md", "USER.md"],
            },
          },
        }),
      );

      await setupCommand(undefined, runtime, deps);

      expect(deps.ensureAgentWorkspace).toHaveBeenCalledOnce();
      const workspaceParams = requireFirstWorkspaceParams(deps.ensureAgentWorkspace);
      expect(workspaceParams.dir).toBe(workspace);
      expect(workspaceParams.skipOptionalBootstrapFiles).toEqual(["IDENTITY.md", "USER.md"]);
    });
  });

  it("treats non-object config roots as empty config", async () => {
    await withTempHome(async (home) => {
      const runtime = {
        log: vi.fn(),
        error: vi.fn(),
        exit: vi.fn(),
      };
      const configDir = path.join(home, ".daisyclaw");
      const configPath = path.join(configDir, "daisyclaw.json");
      const deps = createSetupDeps(home);
      const workspace = path.join(home, ".daisyclaw", "workspace");

      await fs.mkdir(configDir, { recursive: true });
      await fs.writeFile(configPath, '"not-an-object"', "utf-8");

      await setupCommand({ workspace }, runtime, deps);

      const raw = JSON.parse(await fs.readFile(configPath, "utf-8")) as {
        agents?: { defaults?: { workspace?: string } };
        gateway?: { mode?: string };
      };

      expect(raw.agents?.defaults?.workspace).toBe(workspace);
      expect(raw.gateway?.mode).toBe("local");
    });
  });
});
