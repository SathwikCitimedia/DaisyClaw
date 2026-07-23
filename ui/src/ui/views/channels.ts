// Control UI view renders channels screen content.
import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp } from "../format.ts";
import type {
  ChannelAccountSnapshot,
  ChannelUiMetaEntry,
  ChannelsStatusSnapshot,
  DiscordStatus,
  GoogleChatStatus,
  IMessageStatus,
  NostrProfile,
  NostrStatus,
  SignalStatus,
  SlackStatus,
  TelegramStatus,
  WhatsAppStatus,
} from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import { renderAllowedContactsSection } from "./channels.contacts.ts";
import { renderDiscordCard } from "./channels.discord.ts";
import { renderGoogleChatCard } from "./channels.googlechat.ts";
import { renderChannelBrandIcon } from "./channels.icons.ts";
import { renderIMessageCard } from "./channels.imessage.ts";
import { renderNostrCard } from "./channels.nostr.ts";
import {
  channelEnabled,
  formatNullableBoolean,
  renderChannelAccountCount,
  resolveChannelDisplayState,
} from "./channels.shared.ts";
import { renderSignalCard } from "./channels.signal.ts";
import { renderSlackCard } from "./channels.slack.ts";
import { renderTelegramCard } from "./channels.telegram.ts";
import type { ChannelKey, ChannelsChannelData, ChannelsProps } from "./channels.types.ts";
import { renderWhatsAppCard } from "./channels.whatsapp.ts";

export function renderChannels(props: ChannelsProps) {
  const channels = props.snapshot?.channels as Record<string, unknown> | null;
  const whatsapp = (channels?.whatsapp ?? undefined) as WhatsAppStatus | undefined;
  const telegram = (channels?.telegram ?? undefined) as TelegramStatus | undefined;
  const discord = (channels?.discord ?? null) as DiscordStatus | null;
  const googlechat = (channels?.googlechat ?? null) as GoogleChatStatus | null;
  const slack = (channels?.slack ?? null) as SlackStatus | null;
  const signal = (channels?.signal ?? null) as SignalStatus | null;
  const imessage = (channels?.imessage ?? null) as IMessageStatus | null;
  const nostr = (channels?.nostr ?? null) as NostrStatus | null;
  const channelData: ChannelsChannelData = {
    whatsapp,
    telegram,
    discord,
    googlechat,
    slack,
    signal,
    imessage,
    nostr,
    channelAccounts: props.snapshot?.channelAccounts ?? null,
  };

  const channelOrder = resolveChannelOrder(props.snapshot);
  const focusChannel = props.focusChannel ?? null;
  const configuredCount = channelOrder.filter((k) => channelEnabled(k, props)).length;

  const showingStaleSnapshot = Boolean(props.loading && props.snapshot && props.lastSuccessAt);
  const partialWarnings = props.snapshot?.warnings?.filter((warning) => warning.trim()) ?? [];

  return html`
    ${renderAccessRequests(props)}

    <div class="ch-list">
      <div class="ch-list__head">
        <span class="ch-list__title">Channels</span>
        <span class="ch-list__count muted"
          >${configuredCount} of ${channelOrder.length} configured</span
        >
      </div>
      <div class="ch-list__rows">${channelOrder.map((key) => renderChannelRow(key, props))}</div>
    </div>

    <details class="ch-group ch-group--health" style="margin-top: 18px;">
      <summary class="ch-group__summary">
        <span class="ch-group__title">${t("channels.health.title")}</span>
        <span class="muted" style="font-size:12px;margin-left:auto;margin-right:8px;">
          ${props.lastSuccessAt ? formatRelativeTimestamp(props.lastSuccessAt) : t("common.na")}
        </span>
        <span class="ch-group__chevron"></span>
      </summary>
      <div class="ch-group__body">
        ${showingStaleSnapshot
          ? html`<div class="callout info" style="margin-bottom:12px;">
              Refreshing channel status in the background; showing the last successful snapshot.
            </div>`
          : nothing}
        ${props.snapshot?.partial
          ? html`<div class="callout warn" style="margin-bottom:12px;">
              Some channel checks did not finish before the UI budget.
              ${partialWarnings.length > 0 ? partialWarnings.slice(0, 3).join("; ") : ""}
            </div>`
          : nothing}
        ${props.lastError
          ? html`<div class="callout danger" style="margin-bottom:12px;">${props.lastError}</div>`
          : nothing}
        <pre class="code-block">
${props.snapshot
            ? JSON.stringify(props.snapshot, null, 2)
            : t("channels.health.noSnapshotYet")}</pre
        >
      </div>
    </details>

    ${focusChannel ? renderChannelDialog(focusChannel, props, channelData) : nothing}
  `;
}

function showChannelDialogWhenClosed(el?: Element) {
  if (!(el instanceof HTMLDialogElement) || el.open) {
    return;
  }
  if (el.isConnected) {
    el.showModal();
  } else {
    queueMicrotask(() => {
      if (el.isConnected && !el.open) {
        el.showModal();
      }
    });
  }
}

type ChannelRowStatus = {
  label: string;
  tone: "ok" | "idle" | "off";
};

function resolveChannelRowStatus(key: ChannelKey, props: ChannelsProps): ChannelRowStatus {
  const state = resolveChannelDisplayState(key, props);
  if (state.connected === true || state.running === true || state.hasAnyActiveAccount) {
    return { label: "Connected", tone: "ok" };
  }
  if (state.configured === true) {
    return { label: "Configured", tone: "idle" };
  }
  return { label: "Not configured", tone: "off" };
}

function renderChannelRow(key: ChannelKey, props: ChannelsProps) {
  const label = resolveChannelLabel(props.snapshot, key);
  const status = resolveChannelRowStatus(key, props);
  const isConfigured = status.tone !== "off";
  const open = () => props.onOpenChannel(key);
  return html`
    <div class="ch-row" data-channel=${key}>
      <div class="ch-row__main">
        ${renderChannelBrandIcon(key)}
        <span class="ch-row__name">${label}</span>
        <span class="ch-row__dot ch-row__dot--${status.tone}" title=${status.label}></span>
      </div>
      <div class="ch-row__meta">
        <span class="ch-row__status ch-row__status--${status.tone}">${status.label}</span>
        <button
          type="button"
          class="btn btn-sm ${isConfigured ? "" : "primary"} ch-row__action"
          @click=${open}
        >
          ${isConfigured ? "Manage" : "Configure"}
        </button>
      </div>
    </div>
  `;
}

function renderChannelDialog(key: ChannelKey, props: ChannelsProps, data: ChannelsChannelData) {
  const label = resolveChannelLabel(props.snapshot, key);
  const status = resolveChannelRowStatus(key, props);
  const close = () => props.onCloseChannel();
  return html`
    <dialog
      class="md-preview-dialog ch-dialog"
      ${ref(showChannelDialogWhenClosed)}
      @click=${(e: Event) => {
        if (e.target === e.currentTarget) {
          (e.currentTarget as HTMLDialogElement).close();
        }
      }}
      @close=${close}
    >
      <div class="md-preview-dialog__panel">
        <div class="md-preview-dialog__header">
          <div class="md-preview-dialog__header-main">
            <span class="md-preview-dialog__eyebrow">Channel</span>
            <div class="ch-dialog__titlerow">
              ${renderChannelBrandIcon(key)}
              <span class="md-preview-dialog__title">${label}</span>
              <span class="ch-row__status ch-row__status--${status.tone}">${status.label}</span>
            </div>
          </div>
          <button
            class="btn btn--sm"
            @click=${(e: Event) => {
              (e.currentTarget as HTMLElement).closest("dialog")?.close();
            }}
          >
            Close
          </button>
        </div>
        <div class="md-preview-dialog__body ch-dialog__body">
          ${renderChannel(key, props, data)}
        </div>
      </div>
    </dialog>
  `;
}

function renderAccessRequests(props: ChannelsProps) {
  const requests = props.pairingRequests ?? [];
  if (requests.length === 0) {
    return nothing;
  }
  return html`
    <div class="ch-requests">
      <div class="ch-requests__header">
        <span class="ch-requests__title">Access requests</span>
        <span class="ch-requests__badge">${requests.length}</span>
      </div>
      <div class="ch-requests__hint muted">
        These people messaged the bot but are not in your allowed contacts. Allow to start replying
        to them.
      </div>
      ${requests.map((entry) => {
        const busy = props.pairingBusy === `${entry.channel}:${entry.id}`;
        const lastSeenMs = Date.parse(entry.lastSeenAt);
        return html`
          <div class="ch-requests__row">
            <div class="ch-requests__who">
              <span class="ch-requests__name">${entry.name || entry.id}</span>
              <span class="ch-requests__meta muted">
                ${entry.name ? `${entry.id} · ` : ""}${resolveChannelLabel(
                  props.snapshot,
                  entry.channel,
                )}${Number.isFinite(lastSeenMs) ? ` · ${formatRelativeTimestamp(lastSeenMs)}` : ""}
              </span>
            </div>
            <div class="ch-requests__actions">
              <button
                class="btn primary btn-sm"
                ?disabled=${busy || Boolean(props.pairingBusy)}
                @click=${() => props.onPairingApprove(entry)}
              >
                ${busy ? "Allowing…" : "Allow"}
              </button>
              <button
                class="btn btn-sm"
                ?disabled=${busy || Boolean(props.pairingBusy)}
                @click=${() => props.onPairingReject(entry)}
              >
                Ignore
              </button>
            </div>
          </div>
        `;
      })}
    </div>
  `;
}

function resolveChannelOrder(snapshot: ChannelsStatusSnapshot | null): ChannelKey[] {
  const ALL: ChannelKey[] = [
    "whatsapp",
    "telegram",
    "discord",
    "googlechat",
    "slack",
    "signal",
    "imessage",
    "nostr",
  ];
  const configured: ChannelKey[] = snapshot?.channelMeta?.length
    ? (snapshot.channelMeta.map((entry) => entry.id) as ChannelKey[])
    : snapshot?.channelOrder?.length
      ? (snapshot.channelOrder as ChannelKey[])
      : [];
  const configuredSet = new Set(configured);
  return [...configured, ...ALL.filter((k) => !configuredSet.has(k))];
}

function renderChannel(key: ChannelKey, props: ChannelsProps, data: ChannelsChannelData) {
  const accountCountLabel = renderChannelAccountCount(key, data.channelAccounts);
  switch (key) {
    case "whatsapp":
      return renderWhatsAppCard({
        props,
        whatsapp: data.whatsapp,
        accountCountLabel,
      });
    case "telegram":
      return renderTelegramCard({
        props,
        telegram: data.telegram,
        telegramAccounts: data.channelAccounts?.telegram ?? [],
        accountCountLabel,
      });
    case "discord":
      return renderDiscordCard({
        props,
        discord: data.discord,
        accountCountLabel,
      });
    case "googlechat":
      return renderGoogleChatCard({
        props,
        googleChat: data.googlechat,
        accountCountLabel,
      });
    case "slack":
      return renderSlackCard({
        props,
        slack: data.slack,
        accountCountLabel,
      });
    case "signal":
      return renderSignalCard({
        props,
        signal: data.signal,
        accountCountLabel,
      });
    case "imessage":
      return renderIMessageCard({
        props,
        imessage: data.imessage,
        accountCountLabel,
      });
    case "nostr": {
      const nostrAccounts = data.channelAccounts?.nostr ?? [];
      const primaryAccount = nostrAccounts[0];
      const accountId = primaryAccount?.accountId ?? "default";
      const profile =
        (primaryAccount as { profile?: NostrProfile | null } | undefined)?.profile ?? null;
      const showForm =
        props.nostrProfileAccountId === accountId ? props.nostrProfileFormState : null;
      const profileFormCallbacks = showForm
        ? {
            onFieldChange: props.onNostrProfileFieldChange,
            onSave: props.onNostrProfileSave,
            onImport: props.onNostrProfileImport,
            onCancel: props.onNostrProfileCancel,
            onToggleAdvanced: props.onNostrProfileToggleAdvanced,
          }
        : null;
      return renderNostrCard({
        props,
        nostr: data.nostr,
        nostrAccounts,
        accountCountLabel,
        profileFormState: showForm,
        profileFormCallbacks,
        onEditProfile: () => props.onNostrProfileEdit(accountId, profile),
      });
    }
    default:
      return renderGenericChannelCard(key, props, data.channelAccounts ?? {});
  }
}

function renderGenericChannelCard(
  key: ChannelKey,
  props: ChannelsProps,
  channelAccounts: Record<string, ChannelAccountSnapshot[]>,
) {
  const label = resolveChannelLabel(props.snapshot, key);
  const displayState = resolveChannelDisplayState(key, props);
  const lastError =
    typeof displayState.status?.lastError === "string" ? displayState.status.lastError : undefined;
  const accounts = channelAccounts[key] ?? [];
  const accountCountLabel = renderChannelAccountCount(key, channelAccounts);

  return html`
    <div class="card">
      <div class="card-title">${label}</div>
      <div class="card-sub">${t("channels.generic.subtitle")}</div>
      ${accountCountLabel}
      ${accounts.length > 0
        ? html`
            <div class="account-card-list">
              ${accounts.map((account) => renderGenericAccount(account))}
            </div>
          `
        : html`
            <div class="status-list" style="margin-top: 16px;">
              <div>
                <span class="label">${t("common.configured")}</span>
                <span>${formatNullableBoolean(displayState.configured)}</span>
              </div>
              <div>
                <span class="label">${t("common.running")}</span>
                <span>${formatNullableBoolean(displayState.running)}</span>
              </div>
              <div>
                <span class="label">${t("common.connected")}</span>
                <span>${formatNullableBoolean(displayState.connected)}</span>
              </div>
            </div>
          `}
      ${lastError
        ? html`<div class="callout danger" style="margin-top: 12px;">${lastError}</div>`
        : nothing}
      ${renderAllowedContactsSection({ channelId: key, props })}
      ${renderChannelConfigSection({ channelId: key, props })}
    </div>
  `;
}

function resolveChannelMetaMap(
  snapshot: ChannelsStatusSnapshot | null,
): Record<string, ChannelUiMetaEntry> {
  if (!snapshot?.channelMeta?.length) {
    return {};
  }
  return Object.fromEntries(snapshot.channelMeta.map((entry) => [entry.id, entry]));
}

function resolveChannelLabel(snapshot: ChannelsStatusSnapshot | null, key: string): string {
  const meta = resolveChannelMetaMap(snapshot)[key];
  return meta?.label ?? snapshot?.channelLabels?.[key] ?? key;
}

const RECENT_ACTIVITY_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

function hasRecentActivity(account: ChannelAccountSnapshot): boolean {
  if (!account.lastInboundAt) {
    return false;
  }
  return Date.now() - account.lastInboundAt < RECENT_ACTIVITY_THRESHOLD_MS;
}

function deriveRunningStatus(account: ChannelAccountSnapshot): string {
  if (account.running) {
    return t("common.yes");
  }
  // If we have recent inbound activity, the channel is effectively running
  if (hasRecentActivity(account)) {
    return t("common.active");
  }
  return t("common.no");
}

function deriveConnectedStatus(account: ChannelAccountSnapshot): string {
  if (account.connected === true) {
    return t("common.yes");
  }
  if (account.connected === false) {
    return t("common.no");
  }
  // If connected is null/undefined but we have recent activity, show as active
  if (hasRecentActivity(account)) {
    return t("common.active");
  }
  return t("common.na");
}

function renderGenericAccount(account: ChannelAccountSnapshot) {
  const runningStatus = deriveRunningStatus(account);
  const connectedStatus = deriveConnectedStatus(account);

  return html`
    <div class="account-card">
      <div class="account-card-header">
        <div class="account-card-title">${account.name || account.accountId}</div>
        <div class="account-card-id">${account.accountId}</div>
      </div>
      <div class="status-list account-card-status">
        <div>
          <span class="label">${t("common.running")}</span>
          <span>${runningStatus}</span>
        </div>
        <div>
          <span class="label">${t("common.configured")}</span>
          <span>${account.configured ? t("common.yes") : t("common.no")}</span>
        </div>
        <div>
          <span class="label">${t("common.connected")}</span>
          <span>${connectedStatus}</span>
        </div>
        <div>
          <span class="label">${t("common.lastInbound")}</span>
          <span
            >${account.lastInboundAt
              ? formatRelativeTimestamp(account.lastInboundAt)
              : t("common.na")}</span
          >
        </div>
        ${account.lastError
          ? html` <div class="account-card-error">${account.lastError}</div> `
          : nothing}
      </div>
    </div>
  `;
}
