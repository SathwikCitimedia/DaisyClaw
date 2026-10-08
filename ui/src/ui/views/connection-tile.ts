// The building blocks of Settings > Connections: one tile per account, and the
// card that opens over the page to connect or disconnect one.
//
// A tile says one thing at a glance: what the account is, whether it is
// connected, and the one thing to do next. Anything longer (steps, fields,
// a confirmation) opens in a card instead of stretching the tile.
import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../icons.ts";
import "../components/modal-dialog.ts";

export type ConnectionTileStatus =
  | "connected"
  | "expired"
  | "not-connected"
  | "waiting"
  | "checking"
  | "unavailable";

export function renderConnectionTile(opts: {
  skillKey: string;
  label: string;
  blurb: string;
  logo: TemplateResult;
  status: ConnectionTileStatus;
  statusText: string;
  /** The one button on the right: Connect, Disconnect or Cancel. */
  action?: TemplateResult | typeof nothing;
  /** Anything under the title row: who is connected, a sign-in in progress, a notice. */
  body?: TemplateResult | typeof nothing;
}): TemplateResult {
  return html`
    <div class="qs-connection" data-connection=${opts.skillKey} data-status=${opts.status}>
      <div class="qs-connection__row">
        <span class="qs-connection__logo" aria-hidden="true">${opts.logo}</span>
        <div class="qs-connection__text">
          <span class="qs-connection__name">${opts.label}</span>
          <span class="qs-connection__blurb" title=${opts.blurb}>${opts.blurb}</span>
        </div>
        <span class="qs-connection__status" data-status=${opts.status}>
          <span class="qs-connection__dot" aria-hidden="true"></span>${opts.statusText}
        </span>
        <div class="qs-connection__action">${opts.action ?? nothing}</div>
      </div>
      ${opts.body && opts.body !== nothing
        ? html`<div class="qs-connection__body">${opts.body}</div>`
        : nothing}
    </div>
  `;
}

/** The card that opens over Settings to connect or disconnect one account. */
export function renderConnectionDialog(opts: {
  skillKey: string;
  title: string;
  subtitle?: string;
  logo?: TemplateResult;
  tone?: "default" | "danger";
  onClose: () => void;
  content: TemplateResult;
}): TemplateResult {
  return html`
    <daisyclaw-modal-dialog label=${opts.title} @modal-cancel=${opts.onClose}>
      <div
        class="qs-connect-dialog ${opts.tone === "danger" ? "qs-connect-dialog--danger" : ""}"
        data-connect-dialog=${opts.skillKey}
      >
        <div class="qs-connect-dialog__head">
          ${opts.logo
            ? html`<span class="qs-connection__logo" aria-hidden="true">${opts.logo}</span>`
            : nothing}
          <div class="qs-connect-dialog__heading">
            <h3 class="qs-connect-dialog__title">${opts.title}</h3>
            ${opts.subtitle
              ? html`<p class="qs-connect-dialog__subtitle">${opts.subtitle}</p>`
              : nothing}
          </div>
          <button
            type="button"
            class="qs-connect-dialog__close"
            aria-label="Close"
            title="Close"
            @click=${opts.onClose}
          >
            ${icons.x}
          </button>
        </div>
        ${opts.content}
      </div>
    </daisyclaw-modal-dialog>
  `;
}

/** A password box with a button to show what was pasted, to check it before sending. */
export function renderSecretInput(opts: {
  env: string;
  value: string;
  disabled: boolean;
  placeholder?: string;
  onInput: (value: string) => void;
}): TemplateResult {
  return html`
    <span class="qs-secret-input">
      <input
        type="password"
        autocomplete="off"
        spellcheck="false"
        placeholder=${opts.placeholder ?? ""}
        data-connection-input=${opts.env}
        .value=${opts.value}
        ?disabled=${opts.disabled}
        @input=${(event: Event) => opts.onInput((event.target as HTMLInputElement).value)}
      />
      <button
        type="button"
        class="qs-secret-input__toggle"
        aria-label="Show"
        aria-pressed="false"
        title="Show"
        @click=${(event: Event) => {
          const button = event.currentTarget as HTMLButtonElement;
          const input = button.parentElement?.querySelector("input");
          if (!input) {
            return;
          }
          const show = input.type === "password";
          input.type = show ? "text" : "password";
          button.setAttribute("aria-pressed", String(show));
          button.setAttribute("aria-label", show ? "Hide" : "Show");
          button.title = show ? "Hide" : "Show";
          button.classList.toggle("is-showing", show);
        }}
      >
        <span class="qs-secret-input__show">${icons.eye}</span>
        <span class="qs-secret-input__hide">${icons.eyeOff}</span>
      </button>
    </span>
  `;
}
