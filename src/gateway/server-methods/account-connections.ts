// Gateway handlers for connecting Google and Spotify from Settings, and for
// checking a pasted account key before Settings saves it.
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateConnectionsCancelParams,
  validateConnectionsCheckKeysParams,
  validateConnectionsConnectParams,
  validateConnectionsDisconnectParams,
  validateConnectionsGoogleSetClientParams,
  validateConnectionsStatusParams,
} from "../../../packages/gateway-protocol/src/index.js";
import {
  AccountConnectionError,
  cancelAccountConnect,
  disconnectAccount,
  getAccountConnectionJobs,
  getAccountConnectionsStatus,
  setGoogleClient,
  startAccountConnect,
} from "../account-connections.js";
import { checkConnectionKeys } from "../connection-keys.js";
import { formatForLog } from "../ws-log.js";
import type { GatewayRequestHandlers, RespondFn } from "./types.js";

function respondInvalid(respond: RespondFn, method: string, errors: unknown) {
  respond(
    false,
    undefined,
    errorShape(
      ErrorCodes.INVALID_REQUEST,
      `invalid ${method} params: ${formatValidationErrors(errors as never)}`,
    ),
  );
}

/** Explains a failure in words the Settings screen can show as they are. */
function respondFailure(
  respond: RespondFn,
  err: unknown,
  log: { warn: (message: string) => void },
  method: string,
) {
  if (err instanceof AccountConnectionError) {
    respond(
      false,
      undefined,
      errorShape(
        err.code === "invalid_request" ? ErrorCodes.INVALID_REQUEST : ErrorCodes.UNAVAILABLE,
        err.message,
        { details: { reason: err.code } },
      ),
    );
    return;
  }
  log.warn(`${method} failed: ${formatForLog(err)}`);
  respond(
    false,
    undefined,
    errorShape(ErrorCodes.UNAVAILABLE, "That did not work. Try again in a moment."),
  );
}

export const accountConnectionHandlers: GatewayRequestHandlers = {
  "connections.status": async ({ params, respond, context }) => {
    if (!validateConnectionsStatusParams(params)) {
      respondInvalid(respond, "connections.status", validateConnectionsStatusParams.errors);
      return;
    }
    try {
      if (params.jobsOnly) {
        respond(true, { jobs: getAccountConnectionJobs() }, undefined);
        return;
      }
      respond(true, await getAccountConnectionsStatus(), undefined);
    } catch (err) {
      respondFailure(respond, err, context.logGateway, "connections.status");
    }
  },
  "connections.google.setClient": async ({ params, respond, context }) => {
    if (!validateConnectionsGoogleSetClientParams(params)) {
      respondInvalid(
        respond,
        "connections.google.setClient",
        validateConnectionsGoogleSetClientParams.errors,
      );
      return;
    }
    try {
      await setGoogleClient(params.credentialsJson);
      respond(true, { ok: true }, undefined);
    } catch (err) {
      respondFailure(respond, err, context.logGateway, "connections.google.setClient");
    }
  },
  "connections.connect": async ({ params, respond, context }) => {
    if (!validateConnectionsConnectParams(params)) {
      respondInvalid(respond, "connections.connect", validateConnectionsConnectParams.errors);
      return;
    }
    try {
      const job = await startAccountConnect({
        service: params.service,
        ...(params.email ? { email: params.email } : {}),
      });
      respond(true, { job }, undefined);
    } catch (err) {
      respondFailure(respond, err, context.logGateway, "connections.connect");
    }
  },
  "connections.cancel": async ({ params, respond }) => {
    if (!validateConnectionsCancelParams(params)) {
      respondInvalid(respond, "connections.cancel", validateConnectionsCancelParams.errors);
      return;
    }
    respond(true, { cancelled: cancelAccountConnect(params.service) }, undefined);
  },
  "connections.disconnect": async ({ params, respond, context }) => {
    if (!validateConnectionsDisconnectParams(params)) {
      respondInvalid(respond, "connections.disconnect", validateConnectionsDisconnectParams.errors);
      return;
    }
    try {
      await disconnectAccount({
        service: params.service,
        ...(params.email ? { email: params.email } : {}),
      });
      respond(true, { ok: true }, undefined);
    } catch (err) {
      respondFailure(respond, err, context.logGateway, "connections.disconnect");
    }
  },
  "connections.checkKeys": async ({ params, respond }) => {
    if (!validateConnectionsCheckKeysParams(params)) {
      respondInvalid(respond, "connections.checkKeys", validateConnectionsCheckKeysParams.errors);
      return;
    }
    respond(true, await checkConnectionKeys({ skillKey: params.skillKey, env: params.env }));
  },
};
