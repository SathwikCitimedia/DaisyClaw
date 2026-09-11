// `system.factoryReset`: erase every user-created thing and start over from
// the first-run wizard. Writes the reset marker and schedules the normal
// in-process gateway restart; the wipe itself runs on the next start (see
// src/infra/factory-reset.ts for why the two halves are split).
import { ErrorCodes, errorShape } from "../../../packages/gateway-protocol/src/index.js";
import {
  FACTORY_RESET_CONFIRM_PHRASE,
  writeFactoryResetMarkerSync,
} from "../../infra/factory-reset.js";
import { scheduleGatewaySigusr1Restart } from "../../infra/restart.js";
import { formatControlPlaneActor, resolveControlPlaneActor } from "../control-plane-audit.js";
import type { GatewayRequestHandlers } from "./types.js";

export const FACTORY_RESET_RESTART_DELAY_MS = 750;

export type FactoryResetHandlerDeps = {
  scheduleRestart: typeof scheduleGatewaySigusr1Restart;
  writeMarker: typeof writeFactoryResetMarkerSync;
};

/** Builds the handler map; deps are injectable so tests never touch the real restart plumbing. */
export function createFactoryResetHandlers(
  deps: Partial<FactoryResetHandlerDeps> = {},
): GatewayRequestHandlers {
  const scheduleRestart = deps.scheduleRestart ?? scheduleGatewaySigusr1Restart;
  const writeMarker = deps.writeMarker ?? writeFactoryResetMarkerSync;
  return {
    "system.factoryReset": ({ params, respond, client, context }) => {
      const confirm = typeof params?.confirm === "string" ? params.confirm : "";
      if (confirm !== FACTORY_RESET_CONFIRM_PHRASE) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.INVALID_REQUEST,
            `system.factoryReset requires confirm: "${FACTORY_RESET_CONFIRM_PHRASE}"`,
          ),
        );
        return;
      }
      const actor = resolveControlPlaneActor(client);
      let marker: ReturnType<typeof writeFactoryResetMarkerSync>;
      try {
        marker = writeMarker({ cfg: context.getRuntimeConfig() });
      } catch (err) {
        respond(
          false,
          undefined,
          errorShape(
            ErrorCodes.UNAVAILABLE,
            `could not record the reset request: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
        return;
      }
      context.logGateway.warn(
        `factory reset requested ${formatControlPlaneActor(actor)} workspaces=${marker.workspaces.length} ` +
          `preservePort=${marker.preserve.port ?? "default"} preserveAuth=${marker.preserve.token || marker.preserve.password ? "yes" : "no"}`,
      );
      const restart = scheduleRestart({
        delayMs: FACTORY_RESET_RESTART_DELAY_MS,
        reason: "system.factoryReset",
        // The wipe happens on the way back up; nothing in flight is worth waiting for.
        skipDeferral: true,
        skipCooldown: true,
        audit: {
          actor: actor.actor,
          deviceId: actor.deviceId,
          clientIp: actor.clientIp,
          changedPaths: [],
        },
      });
      respond(
        true,
        {
          ok: true,
          requestedAt: marker.requestedAt,
          restart: {
            ok: restart.ok,
            mode: restart.mode,
            delayMs: restart.delayMs,
            coalesced: restart.coalesced,
          },
        },
        undefined,
      );
    },
  };
}

export const factoryResetHandlers: GatewayRequestHandlers = createFactoryResetHandlers();
