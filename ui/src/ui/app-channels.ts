// Control UI module implements app channels behavior.
import { resolveControlUiAuthHeader } from "./control-ui-auth.ts";
import {
  addAllowedContacts,
  approvePairingRequest,
  connectWhatsApp,
  disconnectChannel,
  enableAndStartChannel,
  loadChannels,
  logoutWhatsApp,
  rejectPairingRequest,
  removeAllowedContact,
  renameAllowedContact,
  setChannelDmPolicy,
  type ChannelsState,
  type PairingRequestEntry,
} from "./controllers/channels.ts";
import { loadConfig, saveConfig, type ConfigState } from "./controllers/config.ts";
import type { NostrProfile } from "./types.ts";
import { createNostrProfileFormState } from "./views/channels.nostr-profile-form.ts";

type NostrProfileFormState = ReturnType<typeof createNostrProfileFormState> | null;

type ChannelsActionHost = ChannelsState &
  ConfigState & {
    hello?: { auth?: { deviceToken?: string | null } | null } | null;
    password?: string;
    settings: { token?: string };
    nostrProfileFormState: NostrProfileFormState;
    nostrProfileAccountId: string | null;
  };

export async function handleWhatsAppConnect(host: ChannelsActionHost, force: boolean) {
  await connectWhatsApp(host as ChannelsState, force);
  await loadConfig(host as ConfigState);
  await loadChannels(host as ChannelsState, true);
}

export async function handleChannelEnable(
  host: ChannelsActionHost,
  channelId: string,
): Promise<boolean> {
  const enabled = await enableAndStartChannel(host as ChannelsState, channelId);
  await loadConfig(host as ConfigState);
  await loadChannels(host as ChannelsState, true);
  return enabled;
}

export async function handleWhatsAppLogout(host: ChannelsActionHost) {
  await logoutWhatsApp(host as ChannelsState);
  await loadChannels(host as ChannelsState, true);
}

export async function handleChannelDisconnect(host: ChannelsActionHost, channelId: string) {
  await disconnectChannel(host as ChannelsState, channelId);
  // Refresh config + status so the UI reflects the disabled channel.
  await loadConfig(host as ConfigState);
  await loadChannels(host as ChannelsState, true);
}

export async function handleContactAdd(host: ChannelsActionHost, channelId: string, value: string) {
  await addAllowedContacts(host as ChannelsState, channelId, [value]);
  await loadConfig(host as ConfigState);
}

export async function handleContactsAdd(
  host: ChannelsActionHost,
  channelId: string,
  values: string[],
  labels?: Record<string, string>,
) {
  await addAllowedContacts(host as ChannelsState, channelId, values, labels);
  await loadConfig(host as ConfigState);
}

export async function handleContactRename(
  host: ChannelsActionHost,
  channelId: string,
  contact: string,
  name: string,
) {
  await renameAllowedContact(host as ChannelsState, channelId, contact, name);
  await loadConfig(host as ConfigState);
}

export async function handlePairingApprove(host: ChannelsActionHost, entry: PairingRequestEntry) {
  await approvePairingRequest(host as ChannelsState, entry);
  await loadConfig(host as ConfigState);
}

export async function handlePairingReject(host: ChannelsActionHost, entry: PairingRequestEntry) {
  await rejectPairingRequest(host as ChannelsState, entry);
}

export async function handleContactRemove(
  host: ChannelsActionHost,
  channelId: string,
  value: string,
): Promise<boolean> {
  const removed = await removeAllowedContact(host as ChannelsState, channelId, value);
  await loadConfig(host as ConfigState);
  return removed;
}

export async function handleDmPolicyChange(
  host: ChannelsActionHost,
  channelId: string,
  policy: string,
) {
  await setChannelDmPolicy(host as ChannelsState, channelId, policy);
  await loadConfig(host as ConfigState);
}

export async function handleChannelConfigSave(host: ChannelsActionHost) {
  const saved = await saveConfig(host as ConfigState);
  const saveError = host.lastError;
  if (!saved) {
    await loadConfig(host as ConfigState);
    if (saveError && !host.lastError) {
      host.lastError = saveError;
    }
    return;
  }
  await loadChannels(host as ChannelsState, true);
}

export async function handleChannelConfigReload(host: ChannelsActionHost) {
  await loadConfig(host as ConfigState, { discardPendingChanges: true });
  await loadChannels(host as ChannelsState, true);
}

function parseValidationErrors(details: unknown): Record<string, string> {
  if (!Array.isArray(details)) {
    return {};
  }
  const errors: Record<string, string> = {};
  for (const entry of details) {
    if (typeof entry !== "string") {
      continue;
    }
    const [rawField, ...rest] = entry.split(":");
    if (!rawField || rest.length === 0) {
      continue;
    }
    const field = rawField.trim();
    const message = rest.join(":").trim();
    if (field && message) {
      errors[field] = message;
    }
  }
  return errors;
}

function resolveNostrAccountId(host: ChannelsActionHost): string {
  const accounts = host.channelsSnapshot?.channelAccounts?.nostr ?? [];
  return accounts[0]?.accountId ?? host.nostrProfileAccountId ?? "default";
}

function buildNostrProfileUrl(accountId: string, suffix = ""): string {
  return `/api/channels/nostr/${encodeURIComponent(accountId)}/profile${suffix}`;
}

function buildGatewayHttpHeaders(host: ChannelsActionHost): Record<string, string> {
  const authorization = resolveControlUiAuthHeader(host);
  return authorization ? { Authorization: authorization } : {};
}

export function handleNostrProfileEdit(
  host: ChannelsActionHost,
  accountId: string,
  profile: NostrProfile | null,
) {
  host.nostrProfileAccountId = accountId;
  host.nostrProfileFormState = createNostrProfileFormState(profile ?? undefined);
}

export function handleNostrProfileCancel(host: ChannelsActionHost) {
  host.nostrProfileFormState = null;
  host.nostrProfileAccountId = null;
}

export function handleNostrProfileFieldChange(
  host: ChannelsActionHost,
  field: keyof NostrProfile,
  value: string,
) {
  const state = host.nostrProfileFormState;
  if (!state) {
    return;
  }
  host.nostrProfileFormState = {
    ...state,
    values: {
      ...state.values,
      [field]: value,
    },
    fieldErrors: {
      ...state.fieldErrors,
      [field]: "",
    },
  };
}

export function handleNostrProfileToggleAdvanced(host: ChannelsActionHost) {
  const state = host.nostrProfileFormState;
  if (!state) {
    return;
  }
  host.nostrProfileFormState = {
    ...state,
    showAdvanced: !state.showAdvanced,
  };
}

export async function handleNostrProfileSave(host: ChannelsActionHost) {
  const state = host.nostrProfileFormState;
  if (!state || state.saving) {
    return;
  }
  const accountId = resolveNostrAccountId(host);

  host.nostrProfileFormState = {
    ...state,
    saving: true,
    error: null,
    success: null,
    fieldErrors: {},
  };

  try {
    const response = await fetch(buildNostrProfileUrl(accountId), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...buildGatewayHttpHeaders(host),
      },
      body: JSON.stringify(state.values),
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      details?: unknown;
      persisted?: boolean;
    } | null;

    if (!response.ok || data?.ok === false || !data) {
      const errorMessage = data?.error ?? `Profile update failed (${response.status})`;
      host.nostrProfileFormState = {
        ...state,
        saving: false,
        error: errorMessage,
        success: null,
        fieldErrors: parseValidationErrors(data?.details),
      };
      return;
    }

    if (!data.persisted) {
      host.nostrProfileFormState = {
        ...state,
        saving: false,
        error: "Profile publish failed on all relays.",
        success: null,
      };
      return;
    }

    host.nostrProfileFormState = {
      ...state,
      saving: false,
      error: null,
      success: "Profile published to relays.",
      fieldErrors: {},
      original: { ...state.values },
    };
    await loadChannels(host as ChannelsState, true);
  } catch (err) {
    host.nostrProfileFormState = {
      ...state,
      saving: false,
      error: `Profile update failed: ${String(err)}`,
      success: null,
    };
  }
}

export async function handleNostrProfileImport(host: ChannelsActionHost) {
  const state = host.nostrProfileFormState;
  if (!state || state.importing) {
    return;
  }
  const accountId = resolveNostrAccountId(host);

  host.nostrProfileFormState = {
    ...state,
    importing: true,
    error: null,
    success: null,
  };

  try {
    const response = await fetch(buildNostrProfileUrl(accountId, "/import"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildGatewayHttpHeaders(host),
      },
      body: JSON.stringify({ autoMerge: true }),
    });
    const data = (await response.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      imported?: NostrProfile;
      merged?: NostrProfile;
      saved?: boolean;
    } | null;

    if (!response.ok || data?.ok === false || !data) {
      const errorMessage = data?.error ?? `Profile import failed (${response.status})`;
      host.nostrProfileFormState = {
        ...state,
        importing: false,
        error: errorMessage,
        success: null,
      };
      return;
    }

    const merged = data.merged ?? data.imported ?? null;
    const nextValues = merged ? { ...state.values, ...merged } : state.values;
    const showAdvanced = Boolean(
      nextValues.banner || nextValues.website || nextValues.nip05 || nextValues.lud16,
    );

    host.nostrProfileFormState = {
      ...state,
      importing: false,
      values: nextValues,
      error: null,
      success: data.saved
        ? "Profile imported from relays. Review and publish."
        : "Profile imported. Review and publish.",
      showAdvanced,
    };

    if (data.saved) {
      await loadChannels(host, true);
    }
  } catch (err) {
    host.nostrProfileFormState = {
      ...state,
      importing: false,
      error: `Profile import failed: ${String(err)}`,
      success: null,
    };
  }
}
