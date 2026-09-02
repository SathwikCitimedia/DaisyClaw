// Guided first-time setup panels for channels. Shown inside the channel
// dialog when a channel is not configured yet (or when the user chooses to
// start over) — hand-holding steps plus only the essential fields, so a
// non-technical user can connect an account without touching the CLI.
// Channels without a guide fall back to the full config card.
import { html, nothing, type TemplateResult } from "lit";
import { ref } from "lit/directives/ref.js";
import type { ChannelsProps } from "./channels.types.ts";
import { scrollQrIntoView } from "./channels.whatsapp.ts";

type SetupField = {
  path: string[];
  label: string;
  placeholder: string;
  secret?: boolean;
  /** Optional fields don't block the Save & Connect button when empty. */
  optional?: boolean;
  /** Renders a fixed-choice select instead of a free-text input. */
  options?: string[];
};

type SetupStep = {
  title: TemplateResult | string;
  detail?: TemplateResult | string;
};

type SetupGuide = {
  intro: string;
  steps: SetupStep[];
  fields: SetupField[];
  afterConnect?: string;
  /** Label for the "start over" action shown in manage mode. */
  replaceLabel: string;
};

const GUIDES: Record<string, SetupGuide> = {
  telegram: {
    intro: "Connect a Telegram bot so you can chat with your assistant on Telegram.",
    steps: [
      {
        title: "Open Telegram",
        detail: "On your phone, or web.telegram.org on your computer.",
      },
      {
        title: html`Search for <strong>@BotFather</strong>`,
        detail:
          "Tap the search icon and type BotFather. Pick the one with the blue verified badge — there are fakes.",
      },
      {
        title: html`Tap <strong>Start</strong>`,
        detail: "This opens the official chat that creates bots.",
      },
      {
        title: html`Send <code>/newbot</code>`,
        detail: "BotFather will ask you a couple of questions.",
      },
      {
        title: "Give your bot a name",
        detail: 'This is the display name people see, e.g. "Daisy Assistant". Anything works.',
      },
      {
        title: "Give it a username",
        detail: 'Must be unique and end with "bot", e.g. my_daisy_bot. If it’s taken, try another.',
      },
      {
        title: "Copy the token",
        detail:
          'BotFather replies "Done!" with a long code like 123456789:AAF... — tap it to copy.',
      },
      {
        title: html`Paste it below and hit <strong>Save &amp; Connect</strong>`,
        detail: "We handle the rest automatically.",
      },
    ],
    fields: [
      {
        path: ["channels", "telegram", "botToken"],
        label: "Bot token",
        placeholder: "123456789:AAF...",
        secret: true,
      },
    ],
    afterConnect:
      "After connecting: open your new bot in Telegram and send it a hello — your assistant will answer there.",
    replaceLabel: "Set up a new bot",
  },
  discord: {
    intro: "Connect a Discord bot so your assistant can join your server.",
    steps: [
      {
        title: "Open the Discord Developer Portal",
        detail: html`Go to
          <a href="https://discord.com/developers/applications" target="_blank" rel="noreferrer"
            >discord.com/developers/applications</a
          >
          and sign in with your Discord account.`,
      },
      {
        title: "Create the application",
        detail:
          'Click "New Application" (top right), give it a name like "Daisy", and click Create.',
      },
      {
        title: "Get the bot token",
        detail:
          'In the left sidebar open "Bot", click "Reset Token", confirm, and copy the token it shows. It’s only shown once.',
      },
      {
        title: "Allow it to read messages",
        detail:
          'On the same Bot page, scroll to "Privileged Gateway Intents" and switch on "Message Content Intent". Save changes.',
      },
      {
        title: "Invite the bot to your server",
        detail:
          'Sidebar "OAuth2" → "URL Generator": tick the "bot" scope, pick permissions (Send Messages + Read Message History is enough), copy the generated URL, open it, and choose your server.',
      },
      {
        title: html`Paste the token below and hit <strong>Save &amp; Connect</strong>`,
      },
    ],
    fields: [
      {
        path: ["channels", "discord", "token"],
        label: "Bot token",
        placeholder: "MTIz...",
        secret: true,
      },
    ],
    afterConnect:
      "After connecting: mention the bot in your server or DM it — your assistant will reply.",
    replaceLabel: "Set up a new bot",
  },
  slack: {
    intro: "Connect a Slack app so your assistant can work inside your workspace.",
    steps: [
      {
        title: "Create a Slack app",
        detail: html`Go to
          <a href="https://api.slack.com/apps" target="_blank" rel="noreferrer"
            >api.slack.com/apps</a
          >, click "Create New App" → "From scratch". Name it (e.g. "Daisy") and pick your
          workspace.`,
      },
      {
        title: "Turn on Socket Mode",
        detail:
          'Sidebar "Socket Mode" → enable it. Slack asks you to create an app-level token: name it, add the "connections:write" scope, click Generate, and copy the token starting with xapp-.',
      },
      {
        title: "Give the bot permissions",
        detail:
          'Sidebar "OAuth & Permissions" → under "Bot Token Scopes" add: chat:write, app_mentions:read, im:history, im:read, im:write.',
      },
      {
        title: "Install the app to your workspace",
        detail:
          'Still in "OAuth & Permissions", click "Install to Workspace" and Allow. Copy the "Bot User OAuth Token" starting with xoxb-.',
      },
      {
        title: html`Paste both tokens below and hit <strong>Save &amp; Connect</strong>`,
      },
    ],
    fields: [
      {
        path: ["channels", "slack", "botToken"],
        label: "Bot token",
        placeholder: "xoxb-...",
        secret: true,
      },
      {
        path: ["channels", "slack", "appToken"],
        label: "App token",
        placeholder: "xapp-...",
        secret: true,
      },
    ],
    afterConnect:
      "After connecting: invite the app to a channel or DM it in Slack — your assistant will reply.",
    replaceLabel: "Set up a new app",
  },
  signal: {
    intro:
      "Connect your Signal account through a small signal-cli bridge that runs in Docker — your assistant replies from your Signal number.",
    steps: [
      {
        title: "Install Docker Desktop (skip if you have it)",
        detail: html`Download from
          <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noreferrer"
            >docker.com/products/docker-desktop</a
          >. The Signal bridge runs as one small container.`,
      },
      {
        title: "Start the Signal bridge",
        detail: html`In a terminal, run:
          <code
            >docker run -d --name signal-api --restart=always -p 8080:8080 -e MODE=json-rpc -v
            signal-cli-data:/home/.local/share/signal-cli bbernhard/signal-cli-rest-api</code
          >`,
      },
      {
        title: "Link it to your phone",
        detail: html`Open
          <a
            href="http://localhost:8080/v1/qrcodelink?device_name=Daisy"
            target="_blank"
            rel="noreferrer"
            >localhost:8080/v1/qrcodelink?device_name=Daisy</a
          >
          in your browser — a QR code appears.`,
      },
      {
        title: "Scan it with Signal on your phone",
        detail: "Signal → Settings → Linked devices → Link new device.",
      },
      {
        title: html`Enter your number below and hit <strong>Save &amp; Connect</strong>`,
        detail:
          "Your Signal number with country code. Keep the bridge URL as-is unless you changed the port.",
      },
    ],
    fields: [
      {
        path: ["channels", "signal", "account"],
        label: "Your Signal number",
        placeholder: "+919876543210",
      },
      {
        path: ["channels", "signal", "httpUrl"],
        label: "Bridge URL",
        placeholder: "http://localhost:8080",
      },
    ],
    afterConnect:
      "After connecting: have an allowed contact message your Signal number — your assistant will reply. Linking as a device keeps Signal on your phone working normally.",
    replaceLabel: "Re-link Signal",
  },
  googlechat: {
    intro: "Connect a Google Chat app so your assistant can chat with you in Google Workspace.",
    steps: [
      {
        title: "Open the Google Cloud console",
        detail: html`Go to
          <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer"
            >console.cloud.google.com</a
          >
          and create a project (or pick an existing one).`,
      },
      {
        title: "Enable the Google Chat API",
        detail: '"APIs & Services" → "Library" → search "Google Chat API" → Enable.',
      },
      {
        title: "Create a service account key",
        detail:
          '"APIs & Services" → "Credentials" → "Create credentials" → "Service account". After it\'s created, open it → "Keys" → "Add key" → JSON. A .json file downloads — save it somewhere permanent and note the path.',
      },
      {
        title: "Configure the Chat app",
        detail:
          'Back in the Chat API page open the "Configuration" tab: set a name, avatar and description, enable "Receive 1:1 messages", and under Connection settings choose "HTTP endpoint URL" pointing at your public gateway URL followed by /googlechat.',
      },
      {
        title: "Copy your project number",
        detail:
          'Cloud console home ("Dashboard") — the project info card shows "Project number" (digits only).',
      },
      {
        title: html`Fill the fields below and hit <strong>Save &amp; Connect</strong>`,
      },
    ],
    fields: [
      {
        path: ["channels", "googlechat", "serviceAccountFile"],
        label: "Service account JSON file path",
        placeholder: "C:\\daisy\\googlechat-service-account.json",
      },
      {
        path: ["channels", "googlechat", "audienceType"],
        label: "Audience type",
        placeholder: "project-number",
        options: ["project-number", "app-url"],
      },
      {
        path: ["channels", "googlechat", "audience"],
        label: "Audience (project number)",
        placeholder: "123456789012",
      },
    ],
    afterConnect:
      "After connecting: in Google Chat, search for your app by name and send it a direct message — your assistant will reply.",
    replaceLabel: "Set up a new app",
  },
  imessage: {
    intro:
      "Bridge iMessage through a Mac. Apple only allows iMessage via the Messages app on macOS, so this channel needs a Mac that stays on and is signed into your Apple ID.",
    steps: [
      {
        title: "Have a Mac ready",
        detail:
          "A Mac mini or any macOS machine that stays awake, signed into Messages with your Apple ID.",
      },
      {
        title: "Install the imsg CLI on that Mac",
        detail: html`In Terminal: <code>brew install steipete/tap/imsg</code> — then verify with
          <code>imsg chats --limit 1</code>.`,
      },
      {
        title: "Grant permissions",
        detail:
          "macOS System Settings → Privacy & Security → give Full Disk Access to the terminal/process that runs imsg (needed to read the Messages database).",
      },
      {
        title: "Gateway on a different machine?",
        detail:
          'If this gateway is not running on that Mac, point the CLI path below at a small SSH wrapper script that runs imsg on the Mac (e.g. a script containing: exec ssh -T your-mac imsg "$@").',
      },
      {
        title: html`Set the CLI path below and hit <strong>Save &amp; Connect</strong>`,
        detail: 'Keep the default "imsg" when the gateway runs directly on the Mac.',
      },
    ],
    fields: [
      {
        path: ["channels", "imessage", "cliPath"],
        label: "imsg CLI path",
        placeholder: "imsg",
      },
    ],
    afterConnect:
      "After connecting: send an iMessage to the signed-in Apple ID from an allowed contact — your assistant will reply.",
    replaceLabel: "Set up again",
  },
  nostr: {
    intro:
      "Connect a Nostr identity so people can DM your assistant over the decentralized Nostr network (encrypted NIP-04 messages).",
    steps: [
      {
        title: "Get a Nostr secret key",
        detail:
          "Use any Nostr client — Damus (iOS), Amethyst (Android), or Iris (web). Create a new profile for your bot; the app generates a keypair for you.",
      },
      {
        title: "Copy the secret key (nsec…)",
        detail:
          'Usually under Settings → Keys. Copy the secret key starting with "nsec" — treat it like a password. Tip: use a fresh identity for the bot, not your personal key.',
      },
      {
        title: html`Paste it below and hit <strong>Save &amp; Connect</strong>`,
        detail: "We connect to well-known public relays automatically — no relay setup needed.",
      },
    ],
    fields: [
      {
        path: ["channels", "nostr", "privateKey"],
        label: "Secret key",
        placeholder: "nsec1...",
        secret: true,
      },
    ],
    afterConnect:
      "After connecting: this page shows the bot's public key (npub). Follow it from your Nostr client and send it a DM — your assistant will reply. You can also set the bot's name and avatar with Edit Profile.",
    replaceLabel: "Use a different key",
  },
};

export function hasChannelSetupGuide(key: string): boolean {
  return key === "whatsapp" || key in GUIDES;
}

export function channelSetupReplaceLabel(key: string): string | null {
  if (key === "whatsapp") {
    return null; // WhatsApp re-links via its own QR relink flow.
  }
  return GUIDES[key]?.replaceLabel ?? null;
}

function readConfigString(form: Record<string, unknown> | null, path: string[]): string {
  let current: unknown = form;
  for (const key of path) {
    if (!current || typeof current !== "object") {
      return "";
    }
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : "";
}

function renderSetupSteps(steps: SetupStep[]) {
  return html`
    <ol class="ch-setup__steps">
      ${steps.map(
        (step) => html`
          <li>
            <div class="ch-setup__step-title">${step.title}</div>
            ${step.detail ? html`<div class="ch-setup__step-detail">${step.detail}</div>` : nothing}
          </li>
        `,
      )}
    </ol>
  `;
}

function renderWhatsAppSetup(props: ChannelsProps) {
  const busy = props.whatsappBusy;
  return html`
    <div class="ch-setup">
      <p class="ch-setup__intro">
        Link your WhatsApp account by scanning a QR code — the same way you link WhatsApp Web.
      </p>
      ${renderSetupSteps([
        {
          title: html`Click <strong>Show QR code</strong> below`,
          detail: "A QR code appears on this page in a few seconds.",
        },
        {
          title: "Open WhatsApp on your phone",
          detail: "Go to Settings → Linked devices → Link a device.",
        },
        {
          title: "Point your phone camera at the QR code",
          detail: "The page updates to Connected automatically once the scan succeeds.",
        },
      ])}
      <div class="ch-setup__actions">
        <button
          class="btn primary"
          ?disabled=${busy}
          @click=${() => props.onWhatsAppConnect(false)}
        >
          ${busy && props.whatsappQrDataUrl
            ? "Waiting for scan…"
            : busy
              ? "Generating QR…"
              : props.whatsappQrDataUrl
                ? "Refresh QR code"
                : "Show QR code"}
        </button>
      </div>
      ${props.whatsappQrDataUrl
        ? html`<div class="ch-setup__qr" ${ref(scrollQrIntoView)}>
            <div class="ch-setup__qr-hint">
              Scan with your phone: WhatsApp → Settings → Linked devices → Link a device
            </div>
            <img src=${props.whatsappQrDataUrl} alt="WhatsApp pairing QR code" />
          </div>`
        : props.whatsappMessage
          ? html`<div class="callout info" style="margin-top:12px;">${props.whatsappMessage}</div>`
          : nothing}
    </div>
  `;
}

export function renderChannelSetup(
  key: string,
  props: ChannelsProps,
): TemplateResult | typeof nothing {
  if (key === "whatsapp") {
    return renderWhatsAppSetup(props);
  }
  const guide = GUIDES[key];
  if (!guide) {
    return nothing;
  }
  const busy = props.channelSetupBusy === key;
  const values = guide.fields.map((field) => readConfigString(props.configForm, field.path));
  const ready = guide.fields.every(
    (field, index) => field.optional || (values[index] ?? "").trim().length > 0,
  );

  return html`
    <div class="ch-setup">
      <p class="ch-setup__intro">${guide.intro}</p>
      ${renderSetupSteps(guide.steps)}
      <div class="ch-setup__fields">
        ${guide.fields.map(
          (field, index) => html`
            <label class="ch-setup__field">
              <span class="ch-setup__field-label">${field.label}</span>
              ${field.options
                ? html`<select
                    class="ch-setup__input"
                    ?disabled=${busy}
                    @change=${(e: Event) =>
                      props.onConfigPatch(field.path, (e.target as HTMLSelectElement).value)}
                  >
                    ${(values[index] ?? "").trim()
                      ? nothing
                      : html`<option value="" selected disabled>Choose…</option>`}
                    ${field.options.map(
                      (option) =>
                        html`<option value=${option} ?selected=${values[index] === option}>
                          ${option}
                        </option>`,
                    )}
                  </select>`
                : html`<input
                    class="ch-setup__input"
                    type=${field.secret ? "password" : "text"}
                    autocomplete="off"
                    spellcheck="false"
                    placeholder=${field.placeholder}
                    .value=${values[index] ?? ""}
                    ?disabled=${busy}
                    @input=${(e: Event) =>
                      props.onConfigPatch(field.path, (e.target as HTMLInputElement).value)}
                  />`}
            </label>
          `,
        )}
      </div>
      <div class="ch-setup__actions">
        <button
          class="btn primary"
          ?disabled=${!ready || busy || props.configSaving}
          @click=${() => props.onChannelSetupConnect(key)}
        >
          ${busy || props.configSaving ? "Connecting…" : "Save & Connect"}
        </button>
      </div>
      ${guide.afterConnect
        ? html`<p class="ch-setup__after muted">${guide.afterConnect}</p>`
        : nothing}
    </div>
  `;
}
