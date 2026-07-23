// Control UI controller manages channels gateway state.
import type { ChannelsStatusSnapshot } from "../types.ts";
import type { ChannelsState, PairingRequestEntry } from "./channels.types.ts";
import {
  formatMissingOperatorReadScopeMessage,
  isMissingOperatorReadScopeError,
} from "./scope-errors.ts";

export type { ChannelsState, PairingRequestEntry };

type LoadChannelsOptions = {
  softTimeoutMs?: number;
};

function delay(ms: number): Promise<"timeout"> {
  return new Promise((resolve) => {
    setTimeout(() => resolve("timeout"), ms);
  });
}

export async function loadChannels(
  state: ChannelsState,
  probe: boolean,
  options: LoadChannelsOptions = {},
) {
  if (!state.client || !state.connected) {
    return;
  }
  if (state.channelsLoading && (!state.channelsLoadingProbe || probe)) {
    return;
  }
  const refreshSeq = (state.channelsRefreshSeq ?? 0) + 1;
  state.channelsRefreshSeq = refreshSeq;
  state.channelsLoading = true;
  state.channelsLoadingProbe = probe;
  state.channelsError = null;
  const refresh = (async () => {
    try {
      const res = await state.client!.request<ChannelsStatusSnapshot | null>("channels.status", {
        probe,
        timeoutMs: 8000,
      });
      if (state.channelsRefreshSeq !== refreshSeq) {
        return;
      }
      state.channelsSnapshot = res;
      state.channelsLastSuccess = Date.now();
      void loadPairingRequests(state);
    } catch (err) {
      if (state.channelsRefreshSeq !== refreshSeq) {
        return;
      }
      if (isMissingOperatorReadScopeError(err)) {
        state.channelsSnapshot = null;
        state.channelsError = formatMissingOperatorReadScopeMessage("channel status");
      } else {
        state.channelsError = String(err);
      }
    } finally {
      if (state.channelsRefreshSeq === refreshSeq) {
        state.channelsLoading = false;
        state.channelsLoadingProbe = null;
      }
    }
  })();

  const softTimeoutMs = options.softTimeoutMs;
  if (typeof softTimeoutMs === "number" && softTimeoutMs > 0) {
    const outcome = await Promise.race([refresh.then(() => "done" as const), delay(softTimeoutMs)]);
    if (outcome === "timeout") {
      return;
    }
    return;
  }
  await refresh;
}

async function ensureChannelEnabled(state: ChannelsState, channelId: string) {
  if (!state.client) {
    return;
  }
  const snapshot = await state.client.request<{
    hash?: string;
    config?: Record<string, unknown>;
  }>("config.get", {});
  const config = snapshot?.config ?? {};
  const channelsConfig = (config.channels ?? {}) as Record<string, unknown>;
  const channelConfig = channelsConfig[channelId] as Record<string, unknown> | undefined;
  const patch: Record<string, unknown> = {};
  if (channelConfig?.enabled === false) {
    patch.channels = { [channelId]: { enabled: true } };
  }
  if (channelId === "whatsapp") {
    const web = config.web as Record<string, unknown> | undefined;
    if (web?.enabled === false) {
      patch.web = { enabled: true };
    }
  }
  if (Object.keys(patch).length === 0) {
    return;
  }
  await state.client.request("config.patch", {
    raw: JSON.stringify(patch),
    baseHash: snapshot?.hash,
  });
}

export async function enableAndStartChannel(state: ChannelsState, channelId: string) {
  if (!state.client || !state.connected || state.channelConnectBusy) {
    return;
  }
  state.channelConnectBusy = channelId;
  state.channelsError = null;
  try {
    await ensureChannelEnabled(state, channelId);
    try {
      await state.client.request("channels.start", { channel: channelId });
    } catch {
      // Some channels start automatically once the config enables them.
    }
  } catch (err) {
    state.channelsError = String(err);
  } finally {
    state.channelConnectBusy = null;
  }
}

function normalizeAllowFromEntry(value: unknown): string {
  return String(value).trim();
}

function readAllowFrom(channelConfig: Record<string, unknown> | undefined): Array<string | number> {
  const raw = channelConfig?.allowFrom;
  return Array.isArray(raw) ? (raw as Array<string | number>) : [];
}

async function patchChannelContacts(
  state: ChannelsState,
  channelId: string,
  mutate: (params: {
    allowFrom: Array<string | number>;
    channelConfig: Record<string, unknown> | undefined;
  }) => { section: Record<string, unknown>; replace?: boolean } | null,
) {
  if (!state.client || !state.connected || state.channelContactsBusy) {
    return;
  }
  state.channelContactsBusy = channelId;
  state.channelContactsError = null;
  try {
    const snapshot = await state.client.request<{
      hash?: string;
      config?: Record<string, unknown>;
    }>("config.get", {});
    const channelsConfig = (snapshot?.config?.channels ?? {}) as Record<string, unknown>;
    const channelConfig = channelsConfig[channelId] as Record<string, unknown> | undefined;
    const result = mutate({ allowFrom: readAllowFrom(channelConfig), channelConfig });
    if (!result) {
      return;
    }
    await state.client.request("config.patch", {
      raw: JSON.stringify({ channels: { [channelId]: result.section } }),
      baseHash: snapshot?.hash,
      ...(result.replace ? { replacePaths: [`channels.${channelId}.allowFrom`] } : {}),
    });
  } catch (err) {
    state.channelContactsError = String(err);
  } finally {
    state.channelContactsBusy = null;
  }
}

export async function addAllowedContacts(
  state: ChannelsState,
  channelId: string,
  rawValues: string[],
) {
  const values = rawValues.map((value) => value.trim()).filter((value) => value.length > 0);
  if (values.length === 0) {
    return;
  }
  await patchChannelContacts(state, channelId, ({ allowFrom, channelConfig }) => {
    const existing = new Set(allowFrom.map((entry) => normalizeAllowFromEntry(entry)));
    const additions: string[] = [];
    for (const value of values) {
      if (!existing.has(value)) {
        existing.add(value);
        additions.push(value);
      }
    }
    if (additions.length === 0) {
      return null;
    }
    const section: Record<string, unknown> = { allowFrom: [...allowFrom, ...additions] };
    // First contact and no explicit DM policy yet: default to allowlist so
    // unknown senders are silently ignored instead of getting pairing codes.
    if (channelConfig?.dmPolicy == null) {
      section.dmPolicy = "allowlist";
    }
    return { section };
  });
}

export async function addAllowedContact(state: ChannelsState, channelId: string, rawValue: string) {
  await addAllowedContacts(state, channelId, [rawValue]);
}

export async function removeAllowedContact(
  state: ChannelsState,
  channelId: string,
  rawValue: string,
) {
  const value = rawValue.trim();
  await patchChannelContacts(state, channelId, ({ allowFrom }) => {
    const next = allowFrom.filter((entry) => normalizeAllowFromEntry(entry) !== value);
    if (next.length === allowFrom.length) {
      return null;
    }
    // Shrinking an array requires explicit intent (replacePaths) on the gateway.
    return { section: { allowFrom: next }, replace: true };
  });
}

export async function setChannelDmPolicy(state: ChannelsState, channelId: string, policy: string) {
  await patchChannelContacts(state, channelId, () => ({ section: { dmPolicy: policy } }));
}

export async function loadPairingRequests(state: ChannelsState) {
  if (!state.client || !state.connected) {
    return;
  }
  try {
    const res = await state.client.request<{ requests?: PairingRequestEntry[] }>(
      "channels.pairing.list",
      {},
    );
    state.pairingRequests = Array.isArray(res?.requests) ? res.requests : [];
  } catch {
    // Older gateways don't expose the inbox; leave it hidden rather than error.
    state.pairingRequests = null;
  }
}

export async function approvePairingRequest(state: ChannelsState, entry: PairingRequestEntry) {
  if (!state.client || !state.connected || state.pairingBusy) {
    return;
  }
  state.pairingBusy = `${entry.channel}:${entry.id}`;
  try {
    await state.client.request("channels.pairing.approve", {
      channel: entry.channel,
      id: entry.id,
    });
    // Persist access in the channel allowlist so approval works in allowlist
    // mode (the pairing store alone is only honored in pairing mode).
    state.pairingBusy = null;
    await addAllowedContacts(state, entry.channel, [entry.id]);
  } catch (err) {
    state.channelsError = String(err);
  } finally {
    state.pairingBusy = null;
    await loadPairingRequests(state);
  }
}

export async function rejectPairingRequest(state: ChannelsState, entry: PairingRequestEntry) {
  if (!state.client || !state.connected || state.pairingBusy) {
    return;
  }
  state.pairingBusy = `${entry.channel}:${entry.id}`;
  try {
    await state.client.request("channels.pairing.reject", {
      channel: entry.channel,
      id: entry.id,
    });
  } catch (err) {
    state.channelsError = String(err);
  } finally {
    state.pairingBusy = null;
    await loadPairingRequests(state);
  }
}

const WHATSAPP_QR_HINT =
  "Scan with your phone: WhatsApp → Settings → Linked devices → Link a device.";
const WHATSAPP_SCAN_WINDOW_MS = 180_000;

export async function connectWhatsApp(state: ChannelsState, force: boolean) {
  if (!state.client || !state.connected || state.whatsappBusy) {
    return;
  }
  state.whatsappBusy = true;
  state.whatsappLoginMessage = "Starting WhatsApp…";
  state.whatsappLoginConnected = null;
  try {
    // Self-heal: re-enable a disabled channel and boot the runtime so the
    // login methods are ready, instead of failing with a cryptic error.
    try {
      await ensureChannelEnabled(state, "whatsapp");
      await state.client.request("channels.start", { channel: "whatsapp" });
    } catch {
      // web.login.start below can still bring the runtime up on demand.
    }

    const start = await state.client.request<{
      message?: string;
      qrDataUrl?: string;
      connected?: boolean;
    }>("web.login.start", { force, timeoutMs: 30000 });
    if (start.connected === true && !start.qrDataUrl) {
      state.whatsappLoginConnected = true;
      state.whatsappLoginQrDataUrl = null;
      state.whatsappLoginMessage = start.message ?? "WhatsApp is already linked.";
      return;
    }
    state.whatsappLoginQrDataUrl = start.qrDataUrl ?? null;
    if (!start.qrDataUrl) {
      state.whatsappLoginMessage = start.message ?? "Could not get a QR code. Try again.";
      return;
    }
    state.whatsappLoginMessage = WHATSAPP_QR_HINT;

    // Poll until the QR is scanned; web.login.wait refreshes rotating codes.
    const deadline = Date.now() + WHATSAPP_SCAN_WINDOW_MS;
    let consecutiveErrors = 0;
    while (Date.now() < deadline) {
      try {
        const wait = await state.client.request<{
          message?: string;
          connected?: boolean;
          qrDataUrl?: string;
        }>("web.login.wait", {
          timeoutMs: 30000,
          currentQrDataUrl: state.whatsappLoginQrDataUrl ?? undefined,
        });
        consecutiveErrors = 0;
        if (wait.connected === true) {
          state.whatsappLoginConnected = true;
          state.whatsappLoginQrDataUrl = null;
          state.whatsappLoginMessage = wait.message ?? "WhatsApp connected.";
          return;
        }
        if (wait.qrDataUrl) {
          state.whatsappLoginQrDataUrl = wait.qrDataUrl;
          state.whatsappLoginMessage = WHATSAPP_QR_HINT;
        }
      } catch (err) {
        consecutiveErrors += 1;
        if (consecutiveErrors >= 2) {
          throw err;
        }
      }
    }
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = false;
    state.whatsappLoginMessage = "The QR was not scanned in time. Click Connect to try again.";
  } catch (err) {
    state.whatsappLoginMessage = String(err);
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } finally {
    state.whatsappBusy = false;
  }
}

export async function disconnectChannel(state: ChannelsState, channelId: string) {
  if (!state.client || !state.connected || state.channelDisconnectBusy) {
    return;
  }
  state.channelDisconnectBusy = channelId;
  state.channelsError = null;
  try {
    // Best-effort: stop the runtime and clear stored credentials. Some
    // token-based channels do not implement logout — disabling below still
    // disconnects them.
    try {
      await state.client.request("channels.logout", { channel: channelId });
    } catch {
      try {
        await state.client.request("channels.stop", { channel: channelId });
      } catch {
        // Channel may not be running at all; disabling below is what matters.
      }
    }
    // Persist the disable so the channel stays disconnected across restarts.
    // config.patch deep-merges the raw object and requires the current hash.
    const snapshot = await state.client.request<{ hash?: string }>("config.get", {});
    await state.client.request("config.patch", {
      raw: JSON.stringify({ channels: { [channelId]: { enabled: false } } }),
      baseHash: snapshot?.hash,
    });
  } catch (err) {
    state.channelsError = String(err);
  } finally {
    state.channelDisconnectBusy = null;
  }
}

export async function logoutWhatsApp(state: ChannelsState) {
  if (!state.client || !state.connected || state.whatsappBusy) {
    return;
  }
  state.whatsappBusy = true;
  try {
    await state.client.request("channels.logout", { channel: "whatsapp" });
    state.whatsappLoginMessage = "Logged out.";
    state.whatsappLoginQrDataUrl = null;
    state.whatsappLoginConnected = null;
  } catch (err) {
    state.whatsappLoginMessage = String(err);
  } finally {
    state.whatsappBusy = false;
  }
}
