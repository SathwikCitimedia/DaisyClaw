// Connecting the accounts Daisy can work with.
//
// Setup used to switch Google, Spotify, Notion and Trello on with a "needs
// account" chip, and then no screen anywhere let anyone connect them. The
// user's first real request ("check my email") failed as a vague apology from
// the model, which reads as the assistant being bad rather than an account
// being missing. This is where they get connected, and what tells the truth
// when they cannot be yet.
//
// Each account is a tile with one button. Connecting opens a card with the
// steps and the boxes to paste into, which closes once the account works;
// disconnecting asks first. Skills added later that need a key of their own
// show up here too, so every account Daisy can use is connected in one place.
import { html, nothing, type TemplateResult } from "lit";
import { icons } from "../icons.ts";
import type { SkillStatusEntry } from "../types.ts";
import {
  renderGoogleSetupCard,
  renderGoogleSignInRow,
  renderSpotifySignInRow,
  type AccountSignInProps,
  type SignInTileActions,
} from "./account-sign-in.ts";
import {
  renderConnectionDialog,
  renderConnectionTile,
  renderSecretInput,
} from "./connection-tile.ts";
import { WIZARD_SKILL_LOGOS } from "./first-run-logos.ts";
import { skillOutlineIcon } from "./skill-icon.ts";

export type ConnectionField = {
  /** Environment variable the skill reads, e.g. NOTION_API_TOKEN. */
  env: string;
  label: string;
  /** A hint under the box, when the steps do not already say it. */
  help?: string;
  placeholder?: string;
};

export type ConnectionDefinition = {
  skillKey: string;
  label: string;
  /** What connecting it lets the user ask for. */
  blurb: string;
  /** Empty when the service needs an OAuth app that is not registered yet. */
  fields: readonly ConnectionField[];
  /** How to get the values, in order; shown on the Connect card. */
  steps?: readonly string[];
  /** The page the values come from. */
  link?: { href: string; label: string };
  /** Shown instead of inputs while the service cannot be connected at all. */
  unavailableNote?: string;
  /**
   * Connected by signing in through Daisy's own tool in the browser (Google
   * through gog, Spotify through spotify_player) rather than by pasting a value.
   */
  signIn?: "google" | "spotify";
  /** Found among the installed skills rather than one of the four setup offers. */
  discovered?: boolean;
};

/**
 * The four accounts the setup wizard offers. Notion and Trello hand out a token
 * the user can paste. Google and Spotify are signed in through the browser by
 * Daisy's own tools: Spotify in one click, Google with the user's own Google
 * sign-in app (an assistant on their own computer, using their own login).
 */
export const CONNECTIONS: readonly ConnectionDefinition[] = [
  {
    skillKey: "gog",
    label: "Google",
    blurb: "Gmail, Calendar and Drive",
    fields: [],
    signIn: "google",
  },
  {
    skillKey: "spotify-player",
    label: "Spotify",
    blurb: "Control your music",
    fields: [],
    signIn: "spotify",
  },
  {
    skillKey: "notion",
    label: "Notion",
    blurb: "Read and update your pages",
    fields: [
      {
        env: "NOTION_API_TOKEN",
        label: "Internal integration secret",
        placeholder: "ntn_…",
      },
    ],
    steps: [
      'Open your Notion integrations page and create a new internal integration. Any name works, for example "Daisy".',
      "Copy its Internal Integration Secret and paste it below.",
      "In Notion, open each page Daisy should see, choose ••• then Connections, and add your integration.",
    ],
    link: { href: "https://www.notion.so/profile/integrations", label: "Open Notion integrations" },
  },
  {
    skillKey: "trello",
    label: "Trello",
    blurb: "Manage your boards and cards",
    fields: [
      { env: "TRELLO_API_KEY", label: "API key" },
      { env: "TRELLO_TOKEN", label: "Token" },
    ],
    steps: [
      "Open Trello's API key page. If Trello asks you to create a Power-Up first, do that; any name works.",
      "Copy the API key and paste it below.",
      "Press the Token link on that same page, allow access, then copy the token and paste it below.",
    ],
    link: { href: "https://trello.com/app-key", label: "Open Trello's API key page" },
  },
];

export type ConnectionStatus = "connected" | "not-connected" | "unavailable";

/**
 * Whether the skill has this value. A value the skill requires is set once it
 * is no longer missing. A skill that can fall back to another tool does not
 * list its key as required, so for its main key the gateway says outright
 * whether it is set; anything it cannot vouch for is not claimed.
 */
function isEnvSet(skill: SkillStatusEntry, env: string): boolean {
  if (skill.missing?.env?.includes(env)) {
    return false;
  }
  if (skill.requirements?.env?.includes(env)) {
    return true;
  }
  return skill.primaryEnv === env && skill.primaryEnvSatisfied === true;
}

/** Whether a connection is usable: switched on, with every value it needs set. */
export function resolveConnectionStatus(
  definition: ConnectionDefinition,
  skill: SkillStatusEntry | undefined,
): ConnectionStatus {
  if (definition.signIn) {
    // The login lives in the tool, not in skill settings. Connecting switches
    // the skill on, so "on and runnable" is the outside sign of a connection;
    // Settings asks the tool itself for the precise answer.
    return skill && skill.disabled !== true && skill.eligible !== false
      ? "connected"
      : "not-connected";
  }
  if (definition.fields.length === 0) {
    return "unavailable";
  }
  if (!skill || skill.disabled) {
    return "not-connected";
  }
  return definition.fields.every((field) => isEnvSet(skill, field.env))
    ? "connected"
    : "not-connected";
}

// ── Skills added later ──

/** Values that are logins (keys, tokens, secrets), not folders or addresses. */
function isCredentialEnv(env: string): boolean {
  return /(KEY|TOKEN|SECRET|PASSWORD)/i.test(env) && !/(_DIR|_PATH|_FILE|_URL|_HOST)$/i.test(env);
}

const WORDS: Record<string, string> = {
  ai: "AI",
  api: "API",
  elevenlabs: "ElevenLabs",
  gh: "GitHub",
  github: "GitHub",
  id: "ID",
  openai: "OpenAI",
  tts: "TTS",
  url: "URL",
};

/** Names for skills already known to need a key, where the skill's own name says little. */
const DISCOVERED_LABELS: Record<string, string> = {
  "gh-issues": "GitHub",
  goplaces: "Google Places",
  "openai-whisper-api": "OpenAI Whisper",
  sag: "ElevenLabs voice",
};

function word(raw: string): string {
  const lower = raw.toLowerCase();
  return WORDS[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** "gh-issues" → "GitHub Issues". */
export function humanizeSkillName(name: string): string {
  return name
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(word)
    .join(" ");
}

/** "ELEVENLABS_API_KEY" → "ElevenLabs API key". */
export function humanizeEnvName(env: string): string {
  return env
    .split("_")
    .filter(Boolean)
    .map((part) => (/^(KEY|TOKEN|SECRET|PASSWORD)$/i.test(part) ? part.toLowerCase() : word(part)))
    .join(" ");
}

function firstSentence(text: string): string {
  const trimmed = text.trim();
  const end = trimmed.search(/[.!?](\s|$)/);
  return end > 0 ? trimmed.slice(0, end + 1) : trimmed;
}

function hostOf(href: string): string {
  try {
    return new URL(href).host.replace(/^www\./, "");
  } catch {
    return href;
  }
}

function discoveredDefinition(skill: SkillStatusEntry, envs: string[]): ConnectionDefinition {
  const label = DISCOVERED_LABELS[skill.skillKey] ?? humanizeSkillName(skill.name);
  const homepage = skill.homepage?.startsWith("http") ? skill.homepage : undefined;
  const fields = envs.map((env) => ({ env, label: humanizeEnvName(env) }));
  const what = fields.length === 1 ? `your ${fields[0].label}` : "these values";
  return {
    skillKey: skill.skillKey,
    label,
    blurb: firstSentence(skill.description) || `Lets Daisy use ${label}`,
    fields,
    steps: [
      homepage
        ? `Sign in to ${hostOf(homepage)} and find ${what} in your account settings.`
        : `Find ${what} in your ${label} account settings.`,
      "Paste it below. It stays on this computer.",
    ],
    ...(homepage ? { link: { href: homepage, label: `Open ${hostOf(homepage)}` } } : {}),
    discovered: true,
  };
}

/**
 * Every account to show: the four setup offers, then any installed skill that
 * needs a key of its own. Built-in extras show while switched on; skills the
 * user added always show. `keep` holds skills already shown, so disconnecting
 * one does not make its tile vanish from under the pointer.
 */
export function resolveConnectionDefinitions(
  skills: readonly SkillStatusEntry[] | undefined,
  keep: ReadonlySet<string> = new Set(),
): ConnectionDefinition[] {
  const builtIn = new Set(CONNECTIONS.map((definition) => definition.skillKey));
  const discovered: ConnectionDefinition[] = [];
  for (const skill of skills ?? []) {
    if (builtIn.has(skill.skillKey) || skill.blockedByAllowlist) {
      continue;
    }
    const envs = [
      ...new Set([
        ...(skill.requirements?.env ?? []),
        ...(skill.primaryEnv ? [skill.primaryEnv] : []),
      ]),
    ].filter(isCredentialEnv);
    if (envs.length === 0) {
      continue;
    }
    const listed = keep.has(skill.skillKey) || !skill.disabled || skill.bundled === false;
    if (listed) {
      discovered.push(discoveredDefinition(skill, envs));
    }
  }
  discovered.sort((a, b) => a.label.localeCompare(b.label));
  return [...CONNECTIONS, ...discovered];
}

// ── Rendering ──

export type ConnectionDialogState = {
  skillKey: string;
  mode: "connect" | "disconnect";
  /** The Google account to sign out, when there is more than one. */
  email?: string;
};

export type ConnectionsProps = {
  skills?: readonly SkillStatusEntry[];
  /** Pending input, keyed by environment variable name. */
  drafts: Readonly<Record<string, string>>;
  busyKey?: string | null;
  notice?: { skillKey: string; kind: "success" | "error"; message: string } | null;
  /** The card open over the list, if any. */
  dialog?: ConnectionDialogState | null;
  onDraftChange: (env: string, value: string) => void;
  onDialogChange: (dialog: ConnectionDialogState | null) => void;
  onConnect: (definition: ConnectionDefinition) => void;
  onDisconnect: (definition: ConnectionDefinition) => void;
  /** Browser sign-in for Google and Spotify. */
  signIn?: AccountSignInProps;
};

/** Skills already shown this session, so a tile never vanishes on disconnect. */
const listedThisSession = new Set<string>();

function logoFor(definition: ConnectionDefinition, skill: SkillStatusEntry | undefined) {
  const logo = WIZARD_SKILL_LOGOS[definition.skillKey];
  if (logo) {
    return logo;
  }
  return html`<span class="qs-connection__icon"
    >${skill ? skillOutlineIcon(skill) : icons.plug}</span
  >`;
}

function renderNotice(notice: ConnectionsProps["notice"], skillKey: string) {
  return notice && notice.skillKey === skillKey
    ? html`<p class="qs-connection__notice" data-tone=${notice.kind} role="status">
        ${notice.message}
      </p>`
    : nothing;
}

function renderKeyTile(
  definition: ConnectionDefinition,
  skill: SkillStatusEntry | undefined,
  props: ConnectionsProps,
): TemplateResult {
  const status = resolveConnectionStatus(definition, skill);
  const busy = props.busyKey === definition.skillKey;
  const logo = logoFor(definition, skill);
  if (status === "unavailable") {
    return renderConnectionTile({
      skillKey: definition.skillKey,
      label: definition.label,
      blurb: definition.unavailableNote ?? definition.blurb,
      logo,
      status,
      statusText: "Coming soon",
    });
  }
  const connected = status === "connected";
  // A connect error belongs to the card; on the tile only outcomes show.
  const tileNotice =
    props.dialog?.skillKey === definition.skillKey
      ? nothing
      : renderNotice(props.notice, definition.skillKey);
  return renderConnectionTile({
    skillKey: definition.skillKey,
    label: definition.label,
    blurb: definition.blurb,
    logo,
    status,
    statusText: connected ? "Connected" : "Not connected",
    action: connected
      ? html`<button
          type="button"
          class="btn btn--sm"
          ?disabled=${busy}
          @click=${() =>
            props.onDialogChange({ skillKey: definition.skillKey, mode: "disconnect" })}
        >
          ${busy ? "Disconnecting…" : "Disconnect"}
        </button>`
      : html`<button
          type="button"
          class="btn btn--sm primary"
          ?disabled=${busy}
          @click=${() => props.onDialogChange({ skillKey: definition.skillKey, mode: "connect" })}
        >
          Connect
        </button>`,
    body: tileNotice,
  });
}

function renderConnectCard(
  definition: ConnectionDefinition,
  skill: SkillStatusEntry | undefined,
  props: ConnectionsProps,
): TemplateResult {
  const busy = props.busyKey === definition.skillKey;
  const canSubmit = definition.fields.every((field) => (props.drafts[field.env] ?? "").trim());
  const close = () => props.onDialogChange(null);
  return renderConnectionDialog({
    skillKey: definition.skillKey,
    title: `Connect ${definition.label}`,
    subtitle: definition.blurb,
    logo: logoFor(definition, skill),
    onClose: close,
    content: html`
      ${definition.steps?.length
        ? html`<ol class="qs-connect-dialog__steps">
            ${definition.steps.map((step) => html`<li>${step}</li>`)}
          </ol>`
        : nothing}
      ${definition.link
        ? html`<a
            class="qs-connect-dialog__link"
            href=${definition.link.href}
            target="_blank"
            rel="noopener noreferrer"
            >${definition.link.label}${icons.externalLink}</a
          >`
        : nothing}
      <form
        class="qs-connect-dialog__form"
        @submit=${(event: Event) => {
          event.preventDefault();
          if (canSubmit && !busy) {
            props.onConnect(definition);
          }
        }}
      >
        ${definition.fields.map(
          (field) => html`
            <label class="qs-connection__field">
              <span class="qs-connection__label">${field.label}</span>
              ${renderSecretInput({
                env: field.env,
                value: props.drafts[field.env] ?? "",
                disabled: busy,
                ...(field.placeholder ? { placeholder: field.placeholder } : {}),
                onInput: (value) => props.onDraftChange(field.env, value),
              })}
              ${field.help ? html`<span class="qs-connection__help">${field.help}</span>` : nothing}
            </label>
          `,
        )}
        ${renderNotice(props.notice, definition.skillKey)}
        <div class="qs-connect-dialog__actions">
          <button type="button" class="btn" ?disabled=${busy} @click=${close}>Cancel</button>
          <button type="submit" class="btn primary" ?disabled=${busy || !canSubmit}>
            ${busy ? "Connecting…" : "Connect"}
          </button>
        </div>
      </form>
    `,
  });
}

function renderDisconnectCard(
  definition: ConnectionDefinition,
  dialog: ConnectionDialogState,
  props: ConnectionsProps,
): TemplateResult {
  const close = () => props.onDialogChange(null);
  const account = dialog.email ?? `your ${definition.label} account`;
  const confirm = () => {
    if (definition.signIn) {
      // The sign-in shows its own progress and outcome on the tile.
      close();
      props.signIn?.onDisconnect(definition.signIn, dialog.email);
      return;
    }
    props.onDisconnect(definition);
  };
  const busy = props.busyKey === definition.skillKey;
  return renderConnectionDialog({
    skillKey: definition.skillKey,
    title: `Disconnect ${definition.label}?`,
    tone: "danger",
    onClose: close,
    content: html`
      <p class="qs-connect-dialog__text">
        Daisy will stop using ${account}.
        ${definition.signIn
          ? "You can connect it again at any time."
          : "The saved key is removed from this computer, and you can connect again at any time."}
      </p>
      ${renderNotice(props.notice, definition.skillKey)}
      <div class="qs-connect-dialog__actions">
        <button type="button" class="btn" ?disabled=${busy} @click=${close}>Cancel</button>
        <button type="button" class="btn danger" ?disabled=${busy} @click=${confirm}>
          ${busy ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
    `,
  });
}

function renderGoogleSetupDialog(signIn: AccountSignInProps, props: ConnectionsProps) {
  // "Use a different file" without picking one must not leave the card saying
  // no file is saved the next time it opens.
  const close = () => {
    signIn.onKeepGoogleFile?.();
    props.onDialogChange(null);
  };
  // Starting the sign-in hands over to the browser; the tile shows the wait.
  const setupProps: AccountSignInProps = {
    ...signIn,
    onConnect: (service) => {
      close();
      signIn.onConnect(service);
    },
    onSetUpWithDaisy: (service) => {
      close();
      signIn.onSetUpWithDaisy(service);
    },
  };
  return renderConnectionDialog({
    skillKey: "gog",
    title: "Connect Google",
    subtitle: "Gmail, Calendar and Drive",
    logo: WIZARD_SKILL_LOGOS.gog,
    onClose: close,
    content: html`<div class="qs-connect-dialog__google">
      ${renderGoogleSetupCard(setupProps)}
    </div>`,
  });
}

function renderDialog(
  definitions: readonly ConnectionDefinition[],
  props: ConnectionsProps,
): TemplateResult | typeof nothing {
  const dialog = props.dialog;
  if (!dialog) {
    return nothing;
  }
  const definition = definitions.find((entry) => entry.skillKey === dialog.skillKey);
  if (!definition) {
    return nothing;
  }
  if (dialog.mode === "disconnect") {
    return renderDisconnectCard(definition, dialog, props);
  }
  if (definition.signIn === "google") {
    return props.signIn ? renderGoogleSetupDialog(props.signIn, props) : nothing;
  }
  if (definition.signIn || definition.fields.length === 0) {
    return nothing;
  }
  const skill = props.skills?.find((entry) => entry.skillKey === definition.skillKey);
  return renderConnectCard(definition, skill, props);
}

/** The Connections card for Quick Settings. */
export function renderConnectionsCard(props: ConnectionsProps): TemplateResult {
  const definitions = resolveConnectionDefinitions(props.skills, listedThisSession);
  for (const definition of definitions) {
    if (definition.discovered) {
      listedThisSession.add(definition.skillKey);
    }
  }
  const tileActions: SignInTileActions = {
    onOpenGoogleSetup: () => props.onDialogChange({ skillKey: "gog", mode: "connect" }),
    onConfirmDisconnect: (service, email) =>
      props.onDialogChange({
        skillKey: service === "google" ? "gog" : "spotify-player",
        mode: "disconnect",
        ...(email ? { email } : {}),
      }),
  };
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
          this, and you can disconnect at any time.
        </p>
        <div class="qs-connections__list">
          ${definitions.map((definition) => {
            if (definition.signIn && props.signIn) {
              return definition.signIn === "google"
                ? renderGoogleSignInRow(props.signIn, tileActions)
                : renderSpotifySignInRow(props.signIn, tileActions);
            }
            const skill = props.skills?.find((entry) => entry.skillKey === definition.skillKey);
            return renderKeyTile(definition, skill, props);
          })}
        </div>
      </div>
      ${renderDialog(definitions, props)}
    </div>
  `;
}
