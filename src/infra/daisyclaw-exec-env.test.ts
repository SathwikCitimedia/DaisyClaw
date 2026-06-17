// Tests DaisyClaw execution environment construction.
import { describe, expect, it } from "vitest";
import {
  ensureDaisyClawExecMarkerOnProcess,
  markDaisyClawExecEnv,
  DAISYCLAW_CLI_ENV_VALUE,
  DAISYCLAW_CLI_ENV_VAR,
} from "./daisyclaw-exec-env.js";

describe("markDaisyClawExecEnv", () => {
  it("returns a cloned env object with the exec marker set", () => {
    const env = { PATH: "/usr/bin", DAISYCLAW_CLI: "0" };
    const marked = markDaisyClawExecEnv(env);

    expect(marked).toEqual({
      PATH: "/usr/bin",
      DAISYCLAW_CLI: DAISYCLAW_CLI_ENV_VALUE,
    });
    expect(marked).not.toBe(env);
    expect(env.DAISYCLAW_CLI).toBe("0");
  });
});

describe("ensureDaisyClawExecMarkerOnProcess", () => {
  it.each([
    {
      name: "mutates and returns the provided process env",
      env: { PATH: "/usr/bin" } as NodeJS.ProcessEnv,
    },
    {
      name: "overwrites an existing marker on the provided process env",
      env: { PATH: "/usr/bin", [DAISYCLAW_CLI_ENV_VAR]: "0" } as NodeJS.ProcessEnv,
    },
  ])("$name", ({ env }) => {
    expect(ensureDaisyClawExecMarkerOnProcess(env)).toBe(env);
    expect(env[DAISYCLAW_CLI_ENV_VAR]).toBe(DAISYCLAW_CLI_ENV_VALUE);
  });

  it("defaults to mutating process.env when no env object is provided", () => {
    const previous = process.env[DAISYCLAW_CLI_ENV_VAR];
    delete process.env[DAISYCLAW_CLI_ENV_VAR];

    try {
      expect(ensureDaisyClawExecMarkerOnProcess()).toBe(process.env);
      expect(process.env[DAISYCLAW_CLI_ENV_VAR]).toBe(DAISYCLAW_CLI_ENV_VALUE);
    } finally {
      if (previous === undefined) {
        delete process.env[DAISYCLAW_CLI_ENV_VAR];
      } else {
        process.env[DAISYCLAW_CLI_ENV_VAR] = previous;
      }
    }
  });
});
