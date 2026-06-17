// Workspace default tests cover environment-variable precedence for the
// built-in agent workspace location.
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDefaultAgentWorkspaceDir } from "./workspace.js";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("DEFAULT_AGENT_WORKSPACE_DIR", () => {
  it("uses DAISYCLAW_HOME when resolving the default workspace dir", () => {
    const home = path.join(path.sep, "srv", "daisyclaw-home");
    vi.stubEnv("DAISYCLAW_HOME", home);
    vi.stubEnv("HOME", path.join(path.sep, "home", "other"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(
      path.join(path.resolve(home), ".daisyclaw", "workspace"),
    );
  });

  it("uses DAISYCLAW_WORKSPACE_DIR before DAISYCLAW_HOME", () => {
    const workspaceDir = path.join(path.sep, "srv", "daisyclaw-workspace");
    vi.stubEnv("DAISYCLAW_WORKSPACE_DIR", workspaceDir);
    vi.stubEnv("DAISYCLAW_HOME", path.join(path.sep, "srv", "daisyclaw-home"));

    expect(resolveDefaultAgentWorkspaceDir()).toBe(path.resolve(workspaceDir));
  });
});
