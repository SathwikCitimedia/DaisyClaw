// Control UI view renders channels.whatsapp screen content.
import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { t } from "../../i18n/index.ts";
import { formatRelativeTimestamp, formatDurationHuman } from "../format.ts";
import type { WhatsAppStatus } from "../types.ts";
import { renderChannelConfigSection } from "./channels.config.ts";
import { renderAllowedContactsSection } from "./channels.contacts.ts";
import {
  formatNullableBoolean,
  renderSingleAccountChannelCard,
  resolveChannelConfigured,
} from "./channels.shared.ts";
import type { ChannelsProps } from "./channels.types.ts";

// Scroll the QR into view the moment it renders — the connect button sits
// right above it, but dialogs can be scrolled anywhere when the QR arrives.
export function scrollQrIntoView(el?: Element) {
  if (!(el instanceof HTMLElement) || typeof el.scrollIntoView !== "function") {
    return;
  }
  requestAnimationFrame(() => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export function renderWhatsAppCard(params: {
  props: ChannelsProps;
  whatsapp?: WhatsAppStatus;
  accountCountLabel: unknown;
}) {
  const { props, whatsapp, accountCountLabel } = params;
  const configured = resolveChannelConfigured("whatsapp", props);
  const linked = whatsapp?.linked === true;

  return renderSingleAccountChannelCard({
    title: "WhatsApp",
    subtitle: "Link WhatsApp Web and monitor connection health.",
    accountCountLabel,
    statusRows: [
      { label: t("common.configured"), value: formatNullableBoolean(configured) },
      { label: t("common.linked"), value: whatsapp?.linked ? t("common.yes") : t("common.no") },
      { label: t("common.running"), value: whatsapp?.running ? t("common.yes") : t("common.no") },
      {
        label: t("common.connected"),
        value: whatsapp?.connected ? t("common.yes") : t("common.no"),
      },
      {
        label: t("common.lastConnect"),
        value: whatsapp?.lastConnectedAt
          ? formatRelativeTimestamp(whatsapp.lastConnectedAt)
          : t("common.na"),
      },
      {
        label: t("common.lastMessage"),
        value: whatsapp?.lastMessageAt
          ? formatRelativeTimestamp(whatsapp.lastMessageAt)
          : t("common.na"),
      },
      {
        label: t("common.authAge"),
        value:
          whatsapp?.authAgeMs != null ? formatDurationHuman(whatsapp.authAgeMs) : t("common.na"),
      },
    ],
    lastError: whatsapp?.lastError,
    extraContent: html`
      <div class="row" style="margin-top: 14px; flex-wrap: wrap;">
        ${linked
          ? html`<button
              class="btn"
              ?disabled=${props.whatsappBusy}
              @click=${() => props.onWhatsAppConnect(true)}
            >
              ${connectButtonLabel(props, t("common.relink"))}
            </button>`
          : html`<button
              class="btn primary"
              ?disabled=${props.whatsappBusy}
              @click=${() => props.onWhatsAppConnect(false)}
            >
              ${connectButtonLabel(props, t("common.connect"))}
            </button>`}
        ${linked
          ? html`<button
              class="btn danger"
              ?disabled=${props.whatsappBusy}
              @click=${() => props.onWhatsAppLogout()}
            >
              ${t("common.logout")}
            </button>`
          : nothing}
        <button class="btn" @click=${() => props.onRefresh(true)}>${t("common.refresh")}</button>
      </div>
      ${props.whatsappQrDataUrl
        ? html`<div class="ch-setup__qr" ${ref(scrollQrIntoView)}>
            <div class="ch-setup__qr-hint">
              Scan with your phone: WhatsApp → Settings → Linked devices → Link a device
            </div>
            <img src=${props.whatsappQrDataUrl} alt="WhatsApp QR" />
          </div>`
        : props.whatsappMessage
          ? html`<div class="callout" style="margin-top: 12px;">${props.whatsappMessage}</div>`
          : nothing}
    `,
    configSection: html`
      ${renderAllowedContactsSection({ channelId: "whatsapp", props })}
      ${renderChannelConfigSection({ channelId: "whatsapp", props })}
    `,
  });
}

function connectButtonLabel(props: ChannelsProps, idleLabel: string): string {
  if (props.whatsappQrDataUrl && props.whatsappBusy) {
    return "Waiting for scan…";
  }
  if (props.whatsappBusy) {
    return "Generating QR…";
  }
  return idleLabel;
}
