// Connecting the accounts Daisy can work with.
//
// Setup used to switch Google, Spotify, Notion and Trello on with a "needs
// account" chip, and then no screen anywhere let anyone connect them. The
// user's first real request ("check my email") failed as a vague apology from
// the model, which reads as the assistant being bad rather than an account
// being missing. This is where they get connected, and what tells the truth
// when they cannot be yet.
import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../icons.ts";
import type { SkillStatusEntry } from "../types.ts";

export type ConnectionField = {
  /** Environment variable the skill reads, e.g. NOTION_API_TOKEN. */
  env: string;
  label: string;
  /** Where the user gets this value. */
  help: string;
};

export type ConnectionDefinition = {
  skillKey: string;
  label: string;
  /** What connecting it lets the user ask for. */
  blurb: string;
  /** Empty when the service needs an OAuth app that is not registered yet. */
  fields: readonly ConnectionField[];
  /** Shown instead of inputs while the service cannot be connected at all. */
  unavailableNote?: string;
};

/**
 * The four accounts the setup wizard offers. Notion and Trello hand out a token
 * the user can paste. Google and Spotify need an OAuth application registered
 * by us before any customer can connect, so they say so plainly rather than
 * offering a box that cannot work.
 */
export const CONNECTIONS: readonly ConnectionDefinition[] = [
  {
    skillKey: "notion",
    label: "Notion",
    blurb: "Read and update your pages",
    fields: [
      {
        env: "NOTION_API_TOKEN",
        label: "Internal integration token",
        help: "Create an integration at notion.so/my-integrations, then share the pages you want Daisy to see with it.",
      },
    ],
  },
  {
    skillKey: "trello",
    label: "Trello",
    blurb: "Manage your boards and cards",
    fields: [
      {
        env: "TRELLO_API_KEY",
        label: "API key",
        help: "Both values come from trello.com/app-key.",
      },
      { env: "TRELLO_TOKEN", label: "Token", help: "Use the Token link on that same page." },
    ],
  },
  {
    skillKey: "gog",
    label: "Google",
    blurb: "Gmail, Calendar and Drive",
    fields: [],
    unavailableNote: "Google sign-in is not available yet. It is coming in a future update.",
  },
  {
    skillKey: "spotify-player",
    label: "Spotify",
    blurb: "Control your music",
    fields: [],
    unavailableNote: "Spotify sign-in is not available yet. It is coming in a future update.",
  },
];

export type ConnectionStatus = "connected" | "not-connected" | "unavailable";

/**
 * Whether a connection is usable. A skill is connected once nothing it needs is
 * missing; a service with no fields to fill cannot be connected here at all.
 */
export function resolveConnectionStatus(
  definition: ConnectionDefinition,
  skill: SkillStatusEntry | undefined,
): ConnectionStatus {
  if (definition.fields.length === 0) {
    return "unavailable";
  }
  if (!skill) {
    return "not-connected";
  }
  const missing = skill.missing?.env ?? [];
  const stillMissing = definition.fields.some((field) => missing.includes(field.env));
  return stillMissing ? "not-connected" : "connected";
}

export type ConnectionsProps = {
  skills?: readonly SkillStatusEntry[];
  /** Pending input, keyed by environment variable name. */
  drafts: Readonly<Record<string, string>>;
  busyKey?: string | null;
  notice?: { skillKey: string; kind: "success" | "error"; message: string } | null;
  onDraftChange: (env: string, value: string) => void;
  onConnect: (definition: ConnectionDefinition) => void;
};

function statusLabel(status: ConnectionStatus): string {
  if (status === "connected") {
    return "Connected";
  }
  return status === "unavailable" ? "Coming soon" : "Not connected";
}

function renderRow(definition: ConnectionDefinition, props: ConnectionsProps): TemplateResult {
  const skill = props.skills?.find((entry) => entry.skillKey === definition.skillKey);
  const status = resolveConnectionStatus(definition, skill);
  const busy = props.busyKey === definition.skillKey;
  const notice = props.notice?.skillKey === definition.skillKey ? props.notice : null;
  const canSubmit = definition.fields.every((field) => (props.drafts[field.env] ?? "").trim());

  return html`
    <div class="qs-connection" data-connection=${definition.skillKey} data-status=${status}>
      <div class="qs-connection__head">
        <span class="qs-connection__name">${definition.label}</span>
        <span class="qs-connection__status" data-status=${status}>${statusLabel(status)}</span>
      </div>
      <p class="qs-connection__blurb">${definition.blurb}</p>
      ${status === "unavailable"
        ? html`<p class="qs-connection__note">${definition.unavailableNote}</p>`
        : status === "connected"
          ? nothing
          : html`
              <div class="qs-connection__fields">
                ${definition.fields.map(
                  (field) => html`
                    <label class="qs-connection__field">
                      <span class="qs-connection__label">${field.label}</span>
                      <input
                        type="password"
                        autocomplete="off"
                        spellcheck="false"
                        data-connection-input=${field.env}
                        .value=${props.drafts[field.env] ?? ""}
                        ?disabled=${busy}
                        @input=${(event: Event) =>
                          props.onDraftChange(field.env, (event.target as HTMLInputElement).value)}
                      />
                      <span class="qs-connection__help">${field.help}</span>
                    </label>
                  `,
                )}
                <button
                  class="btn btn--sm btn--primary"
                  ?disabled=${busy || !canSubmit}
                  @click=${() => props.onConnect(definition)}
                >
                  ${busy ? "Connecting…" : "Connect"}
                </button>
              </div>
            `}
      ${notice
        ? html`<p class="qs-connection__notice" data-tone=${notice.kind}>${notice.message}</p>`
        : nothing}
    </div>
  `;
}

/** The Connections card for Quick Settings. */
export function renderConnectionsCard(props: ConnectionsProps): TemplateResult {
  return html`
    <div class="qs-card qs-card--connections" data-qs-connections>
      <div class="qs-card__header">
        <div class="qs-card__header-left">
          <span class="qs-card__icon">${icons.link}</span>
          <h3 class="qs-card__title">Connections</h3>
        </div>
      </div>
      <div class="qs-card__body qs-connections">
        <p class="qs-connections__intro">
          Connect an account and Daisy can work with it for you. Nothing is connected until you do
          this, and you can disconnect by clearing the value.
        </p>
        ${CONNECTIONS.map((definition) => renderRow(definition, props))}
      </div>
    </div>
  `;
}
