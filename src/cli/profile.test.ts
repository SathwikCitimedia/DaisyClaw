// Profile CLI tests cover profile selection, persistence, and command wiring.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatCliCommand } from "./command-format.js";
import { applyCliProfileEnv, parseCliProfileArgs } from "./profile.js";

describe("parseCliProfileArgs", () => {
  it("leaves gateway --dev for subcommands", () => {
    const res = parseCliProfileArgs([
      "node",
      "daisyclaw",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "daisyclaw", "gateway", "--dev", "--allow-unconfigured"]);
  });

  it("leaves gateway --dev for subcommands after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "daisyclaw",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "daisyclaw",
      "--no-color",
      "gateway",
      "--dev",
      "--allow-unconfigured",
    ]);
  });

  it("still accepts global --dev before subcommand", () => {
    const res = parseCliProfileArgs(["node", "daisyclaw", "--dev", "gateway"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "daisyclaw", "gateway"]);
  });

  it("parses --profile value and strips it", () => {
    const res = parseCliProfileArgs(["node", "daisyclaw", "--profile", "work", "status"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "daisyclaw", "status"]);
  });

  it("parses interleaved --profile after the command token", () => {
    const res = parseCliProfileArgs(["node", "daisyclaw", "status", "--profile", "work", "--deep"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "daisyclaw", "status", "--deep"]);
  });

  it("preserves Matrix QA --profile for the command parser", () => {
    const res = parseCliProfileArgs([
      "node",
      "daisyclaw",
      "qa",
      "matrix",
      "--profile",
      "fast",
      "--fail-fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual([
      "node",
      "daisyclaw",
      "qa",
      "matrix",
      "--profile",
      "fast",
      "--fail-fast",
    ]);
  });

  it("preserves Matrix QA --profile after leading root options", () => {
    const res = parseCliProfileArgs([
      "node",
      "daisyclaw",
      "--no-color",
      "qa",
      "matrix",
      "--profile=fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBeNull();
    expect(res.argv).toEqual(["node", "daisyclaw", "--no-color", "qa", "matrix", "--profile=fast"]);
  });

  it("still parses root --profile before Matrix QA", () => {
    const res = parseCliProfileArgs([
      "node",
      "daisyclaw",
      "--profile",
      "work",
      "qa",
      "matrix",
      "--fail-fast",
    ]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("work");
    expect(res.argv).toEqual(["node", "daisyclaw", "qa", "matrix", "--fail-fast"]);
  });

  it("parses interleaved --dev after the command token", () => {
    const res = parseCliProfileArgs(["node", "daisyclaw", "status", "--dev"]);
    if (!res.ok) {
      throw new Error(res.error);
    }
    expect(res.profile).toBe("dev");
    expect(res.argv).toEqual(["node", "daisyclaw", "status"]);
  });

  it("rejects missing profile value", () => {
    const res = parseCliProfileArgs(["node", "daisyclaw", "--profile"]);
    expect(res.ok).toBe(false);
  });

  it.each([
    ["--dev first", ["node", "daisyclaw", "--dev", "--profile", "work", "status"]],
    ["--profile first", ["node", "daisyclaw", "--profile", "work", "--dev", "status"]],
    ["interleaved after command", ["node", "daisyclaw", "status", "--profile", "work", "--dev"]],
  ])("rejects combining --dev with --profile (%s)", (_name, argv) => {
    const res = parseCliProfileArgs(argv);
    expect(res.ok).toBe(false);
  });
});

describe("applyCliProfileEnv", () => {
  it("fills env defaults for dev profile", () => {
    const env: Record<string, string | undefined> = {};
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    const expectedStateDir = path.join(path.resolve("/home/peter"), ".daisyclaw-dev");
    expect(env.DAISYCLAW_PROFILE).toBe("dev");
    expect(env.DAISYCLAW_STATE_DIR).toBe(expectedStateDir);
    expect(env.DAISYCLAW_CONFIG_PATH).toBe(path.join(expectedStateDir, "daisyclaw.json"));
    expect(env.DAISYCLAW_GATEWAY_PORT).toBe("19001");
  });

  it("does not override explicit env values", () => {
    const env: Record<string, string | undefined> = {
      DAISYCLAW_PROFILE: "prod",
      DAISYCLAW_STATE_DIR: "/custom",
      DAISYCLAW_GATEWAY_PORT: "19099",
    };
    applyCliProfileEnv({
      profile: "dev",
      env,
      homedir: () => "/home/peter",
    });
    expect(env.DAISYCLAW_PROFILE).toBe("dev");
    expect(env.DAISYCLAW_STATE_DIR).toBe("/custom");
    expect(env.DAISYCLAW_GATEWAY_PORT).toBe("19099");
    expect(env.DAISYCLAW_CONFIG_PATH).toBe(path.join("/custom", "daisyclaw.json"));
  });

  it("uses DAISYCLAW_HOME when deriving profile state dir", () => {
    const env: Record<string, string | undefined> = {
      DAISYCLAW_HOME: "/srv/daisyclaw-home",
      HOME: "/home/other",
    };
    applyCliProfileEnv({
      profile: "work",
      env,
      homedir: () => "/home/fallback",
    });

    const resolvedHome = path.resolve("/srv/daisyclaw-home");
    expect(env.DAISYCLAW_STATE_DIR).toBe(path.join(resolvedHome, ".daisyclaw-work"));
    expect(env.DAISYCLAW_CONFIG_PATH).toBe(
      path.join(resolvedHome, ".daisyclaw-work", "daisyclaw.json"),
    );
  });
});

describe("formatCliCommand", () => {
  it.each([
    {
      name: "no profile is set",
      cmd: "daisyclaw doctor --fix",
      env: {},
      expected: "daisyclaw doctor --fix",
    },
    {
      name: "profile is default",
      cmd: "daisyclaw doctor --fix",
      env: { DAISYCLAW_PROFILE: "default" },
      expected: "daisyclaw doctor --fix",
    },
    {
      name: "profile is Default (case-insensitive)",
      cmd: "daisyclaw doctor --fix",
      env: { DAISYCLAW_PROFILE: "Default" },
      expected: "daisyclaw doctor --fix",
    },
    {
      name: "profile is invalid",
      cmd: "daisyclaw doctor --fix",
      env: { DAISYCLAW_PROFILE: "bad profile" },
      expected: "daisyclaw doctor --fix",
    },
    {
      name: "--profile is already present",
      cmd: "daisyclaw --profile work doctor --fix",
      env: { DAISYCLAW_PROFILE: "work" },
      expected: "daisyclaw --profile work doctor --fix",
    },
    {
      name: "--dev is already present",
      cmd: "daisyclaw --dev doctor",
      env: { DAISYCLAW_PROFILE: "dev" },
      expected: "daisyclaw --dev doctor",
    },
  ])("returns command unchanged when $name", ({ cmd, env, expected }) => {
    expect(formatCliCommand(cmd, env)).toBe(expected);
  });

  it("inserts --profile flag when profile is set", () => {
    expect(formatCliCommand("daisyclaw doctor --fix", { DAISYCLAW_PROFILE: "work" })).toBe(
      "daisyclaw --profile work doctor --fix",
    );
  });

  it("trims whitespace from profile", () => {
    expect(formatCliCommand("daisyclaw doctor --fix", { DAISYCLAW_PROFILE: "  jbdaisyclaw  " })).toBe(
      "daisyclaw --profile jbdaisyclaw doctor --fix",
    );
  });

  it("handles command with no args after daisyclaw", () => {
    expect(formatCliCommand("daisyclaw", { DAISYCLAW_PROFILE: "test" })).toBe(
      "daisyclaw --profile test",
    );
  });

  it("handles pnpm wrapper", () => {
    expect(formatCliCommand("pnpm daisyclaw doctor", { DAISYCLAW_PROFILE: "work" })).toBe(
      "pnpm daisyclaw --profile work doctor",
    );
  });

  it("inserts --container when a container hint is set", () => {
    expect(
      formatCliCommand("daisyclaw gateway status --deep", { DAISYCLAW_CONTAINER_HINT: "demo" }),
    ).toBe("daisyclaw --container demo gateway status --deep");
  });

  it("ignores unsafe container hints", () => {
    expect(
      formatCliCommand("daisyclaw gateway status --deep", {
        DAISYCLAW_CONTAINER_HINT: "demo; rm -rf /",
      }),
    ).toBe("daisyclaw gateway status --deep");
  });

  it("preserves both --container and --profile hints", () => {
    expect(
      formatCliCommand("daisyclaw doctor", {
        DAISYCLAW_CONTAINER_HINT: "demo",
        DAISYCLAW_PROFILE: "work",
      }),
    ).toBe("daisyclaw --container demo doctor");
  });

  it("does not prepend --container for update commands", () => {
    expect(formatCliCommand("daisyclaw update", { DAISYCLAW_CONTAINER_HINT: "demo" })).toBe(
      "daisyclaw update",
    );
    expect(
      formatCliCommand("pnpm daisyclaw update --channel beta", { DAISYCLAW_CONTAINER_HINT: "demo" }),
    ).toBe("pnpm daisyclaw update --channel beta");
  });
});
