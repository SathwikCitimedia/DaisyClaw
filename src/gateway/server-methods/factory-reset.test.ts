import fs from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ErrorCodes } from "../../../packages/gateway-protocol/src/index.js";
import type { DaisyClawConfig } from "../../config/types.daisyclaw.js";
import { FACTORY_RESET_MARKER_FILENAME } from "../../infra/factory-reset.js";
import { withDaisyClawTestState } from "../../test-utils/daisyclaw-test-state.js";
import { createFactoryResetHandlers } from "./factory-reset.js";
import type { RespondFn } from "./types.js";

function createHarness() {
  const scheduleRestart = vi.fn(() => ({
    ok: true,
    pid: 1,
    signal: "SIGUSR1" as const,
    delayMs: 750,
    mode: "emit" as const,
    coalesced: false,
    cooldownMsApplied: 0,
    ownsPendingRestart: true,
  }));
  const handlers = createFactoryResetHandlers({
    scheduleRestart: scheduleRestart as never,
  });
  const call = (params: Record<string, unknown>, runtimeConfig: DaisyClawConfig) => {
    const respond = vi.fn();
    const warn = vi.fn();
    handlers["system.factoryReset"]({
      req: { type: "req", id: "req-reset", method: "system.factoryReset", params },
      params,
      respond: respond as RespondFn,
      client: null,
      isWebchatConnect: () => false,
      context: {
        getRuntimeConfig: () => runtimeConfig,
        logGateway: { warn, info: vi.fn(), debug: vi.fn(), error: vi.fn() },
      } as never,
    });
    return { respond, warn };
  };
  return { scheduleRestart, call };
}

describe("system.factoryReset", () => {
  it("rejects calls without the confirm phrase and writes nothing", async () => {
    await withDaisyClawTestState({ applyEnv: true }, async (state) => {
      const { scheduleRestart, call } = createHarness();
      const { respond } = call({}, {} as DaisyClawConfig);
      expect(respond).toHaveBeenCalledTimes(1);
      const [ok, , error] = respond.mock.calls[0] as [boolean, unknown, { code: string }];
      expect(ok).toBe(false);
      expect(error.code).toBe(ErrorCodes.INVALID_REQUEST);
      expect(fs.existsSync(state.statePath(FACTORY_RESET_MARKER_FILENAME))).toBe(false);
      expect(scheduleRestart).not.toHaveBeenCalled();
    });
  });

  it("records the marker with the preserved gateway plumbing and schedules a restart", async () => {
    await withDaisyClawTestState({ applyEnv: true }, async (state) => {
      const { scheduleRestart, call } = createHarness();
      const cfg = {
        gateway: { mode: "local", port: 18789, auth: { token: "tok" } },
      } as DaisyClawConfig;
      const { respond, warn } = call({ confirm: "erase-everything" }, cfg);
      expect(respond).toHaveBeenCalledTimes(1);
      const [ok, payload] = respond.mock.calls[0] as [
        boolean,
        { ok: boolean; restart: { mode: string } },
      ];
      expect(ok).toBe(true);
      expect(payload.ok).toBe(true);
      expect(payload.restart.mode).toBe("emit");
      const marker = JSON.parse(
        fs.readFileSync(state.statePath(FACTORY_RESET_MARKER_FILENAME), "utf8"),
      ) as { preserve: Record<string, unknown> };
      expect(marker.preserve).toEqual({ mode: "local", port: 18789, token: "tok" });
      expect(scheduleRestart).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: "system.factoryReset",
          skipDeferral: true,
          skipCooldown: true,
        }),
      );
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("factory reset requested"));
    });
  });
});
