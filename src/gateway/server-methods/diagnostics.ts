// Diagnostics gateway methods expose bounded stability snapshots while keeping
// malformed queries out of logging internals.
import { ErrorCodes, errorShape } from "../../../packages/gateway-protocol/src/index.js";
import {
  getDiagnosticStabilitySnapshot,
  normalizeDiagnosticStabilityQuery,
} from "../../logging/diagnostic-stability.js";
import type { GatewayRequestHandlers } from "./types.js";

/** Gateway handler for payload-free stability diagnostics. */
export const diagnosticsHandlers: GatewayRequestHandlers = {
  // One click for "something is wrong, here is everything a human needs".
  // Writes the standard redacted support bundle and hands back its path so the
  // dashboard can tell the user exactly which file to send.
  "diagnostics.supportBundle": async ({ respond }) => {
    try {
      const { writeDiagnosticSupportExport } =
        await import("../../logging/diagnostic-support-export.js");
      const result = await writeDiagnosticSupportExport({});
      respond(
        true,
        {
          ok: true,
          path: result.path,
          bytes: result.bytes,
          generatedAt: result.manifest.generatedAt,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
  "diagnostics.stability": async ({ params, respond }) => {
    try {
      // Normalization owns parameter bounds so malformed diagnostic requests
      // return a client error instead of leaking logging internals.
      const query = normalizeDiagnosticStabilityQuery(params);
      respond(true, getDiagnosticStabilitySnapshot(query), undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          err instanceof Error ? err.message : "invalid diagnostics.stability params",
        ),
      );
    }
  },
};
