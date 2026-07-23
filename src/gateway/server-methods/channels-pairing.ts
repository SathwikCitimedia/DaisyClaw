// Gateway RPC handlers for the channel DM access-requests inbox
// (channels.pairing.*): list unknown senders who knocked, approve or dismiss
// them from the control UI instead of the CLI.
import { normalizeOptionalString } from "@daisyclaw/normalization-core/string-coerce";
import { ErrorCodes, errorShape } from "../../../packages/gateway-protocol/src/index.js";
import { normalizeChannelId } from "../../channels/plugins/index.js";
import { listPairingChannels, notifyPairingApproved } from "../../channels/plugins/pairing.js";
import {
  approveChannelPairingCode,
  listChannelPairingRequests,
  rejectChannelPairingRequest,
  type PairingRequest,
} from "../../pairing/pairing-store.js";
import type { PairingChannel } from "../../pairing/pairing-store.types.js";
import type { GatewayRequestHandlers, RespondFn } from "./types.js";

export type ChannelPairingRequestPayload = {
  channel: string;
  id: string;
  code: string;
  createdAt: string;
  lastSeenAt: string;
  name?: string;
  accountId?: string;
};

function toRequestPayload(channel: string, entry: PairingRequest): ChannelPairingRequestPayload {
  return {
    channel,
    id: entry.id,
    code: entry.code,
    createdAt: entry.createdAt,
    lastSeenAt: entry.lastSeenAt,
    name: normalizeOptionalString(entry.meta?.name) ?? undefined,
    accountId: normalizeOptionalString(entry.meta?.accountId) ?? undefined,
  };
}

function resolvePairingChannelOrRespond(
  rawChannel: unknown,
  respond: RespondFn,
): PairingChannel | null {
  const channel = normalizeOptionalString(rawChannel);
  if (!channel) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "channel (string) required"));
    return null;
  }
  const normalized = normalizeChannelId(channel);
  if (!normalized) {
    respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "unknown channel"));
    return null;
  }
  return normalized;
}

function readCodeOrId(params: unknown): string | null {
  const record = (params ?? {}) as Record<string, unknown>;
  return normalizeOptionalString(record.code) ?? normalizeOptionalString(record.id) ?? null;
}

export const channelsPairingHandlers: GatewayRequestHandlers = {
  "channels.pairing.list": async ({ params, respond }) => {
    const record = (params ?? {}) as Record<string, unknown>;
    const channelFilter = normalizeOptionalString(record.channel);
    const filtered = channelFilter ? normalizeChannelId(channelFilter) : null;
    const channels: PairingChannel[] = channelFilter
      ? filtered
        ? [filtered]
        : []
      : listPairingChannels();
    const requests: ChannelPairingRequestPayload[] = [];
    for (const channel of channels) {
      try {
        const entries = await listChannelPairingRequests(channel);
        requests.push(...entries.map((entry) => toRequestPayload(channel, entry)));
      } catch {
        // A channel whose pairing store is unreadable should not hide the rest.
      }
    }
    respond(true, { requests }, undefined);
  },
  "channels.pairing.approve": async ({ params, respond, context }) => {
    const channel = resolvePairingChannelOrRespond(
      ((params ?? {}) as Record<string, unknown>).channel,
      respond,
    );
    if (!channel) {
      return;
    }
    const codeOrId = readCodeOrId(params);
    if (!codeOrId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "code or id (string) required"),
      );
      return;
    }
    // Approving by sender id is the UI's natural shape; resolve it to the
    // pending entry's code so the store's approve path stays canonical.
    let code = codeOrId;
    const entries = await listChannelPairingRequests(channel);
    const byId = entries.find((entry) => entry.id === codeOrId);
    if (byId) {
      code = byId.code;
    }
    const approved = await approveChannelPairingCode({ channel, code });
    if (!approved) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `no pending request matches "${codeOrId}"`),
      );
      return;
    }
    const accountId = normalizeOptionalString(approved.entry?.meta?.accountId);
    try {
      await notifyPairingApproved({
        channelId: channel,
        id: approved.id,
        cfg: context.getRuntimeConfig(),
        ...(accountId ? { accountId } : {}),
      });
    } catch {
      // Approval already succeeded; notification is best-effort.
    }
    respond(true, { channel, id: approved.id }, undefined);
  },
  "channels.pairing.reject": async ({ params, respond }) => {
    const channel = resolvePairingChannelOrRespond(
      ((params ?? {}) as Record<string, unknown>).channel,
      respond,
    );
    if (!channel) {
      return;
    }
    const codeOrId = readCodeOrId(params);
    if (!codeOrId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "code or id (string) required"),
      );
      return;
    }
    const rejected = await rejectChannelPairingRequest({ channel, codeOrId });
    if (!rejected) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `no pending request matches "${codeOrId}"`),
      );
      return;
    }
    respond(true, { channel, id: rejected.id }, undefined);
  },
};
