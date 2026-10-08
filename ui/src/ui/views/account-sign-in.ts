// Settings tiles for the accounts that are signed in through the browser:
// Spotify in one click, Google with the user's own Google sign-in app.
//
// Each tile says what is true right now: connected (and as whom), waiting for
// the user in the browser, or not connected with the one next step. Nothing
// here claims a connection the gateway has not confirmed. Google's setup steps
// open in a card rather than filling the tile.
import { html, nothing, type TemplateResult } from "lit";
import { renderConnectionTile } from "./connection-tile.ts";
import { WIZARD_SKILL_LOGOS } from "./first-run-logos.ts";

export type SignInService = "google" | "spotify";

export type SignInJobView = {
  state: "running" | "succeeded" | "failed" | "cancelled";
  message?: string;
  authUrl?: string;
};

export type AccountSignInStatus = {
  google: {
    installed: boolean;
    hasClient: boolean;
    accounts: string[];
    /** Accounts Google no longer accepts the saved sign-in for. Absent on older engines. */
    expiredAccounts?: string[];
  };
  spotify: { installed: boolean; connected: boolean };
  jobs: Partial<Record<SignInService, SignInJobView>>;
};

export type SignInBusy = "installing" | "saving-file" | "starting" | "cancelling" | "disconnecting";

export type SignInNotice = { kind: "success" | "error" | "info"; message: string };

export type AccountSignInProps = {
  status: AccountSignInStatus | null;
  loading: boolean;
  /** The engine is older than this screen and cannot sign in from here. */
  unsupported: boolean;
  busy: Partial<Record<SignInService, SignInBusy>>;
  notice: Partial<Record<SignInService, SignInNotice>>;
  googleEmail: string;
  /** The user asked to replace an already saved Google sign-in file. */
  replacingGoogleFile: boolean;
  onGoogleEmailChange: (value: string) => void;
  onGoogleClientFile: (file: File) => void;
  onReplaceGoogleFile: () => void;
  /** Back out of replacing the saved Google sign-in file and keep it. */
  onKeepGoogleFile?: () => void;
  onConnect: (service: SignInService) => void;
  onCancel: (service: SignInService) => void;
  onDisconnect: (service: SignInService, email?: string) => void;
  onSetUpWithDaisy: (service: SignInService) => void;
  onCopyLink: (url: string) => void;
  onRefresh: () => void;
};

/** What a tile asks of the Connections card, which owns the cards that open over it. */
export type SignInTileActions = {
  /** Opens the card with Google's setup steps. */
  onOpenGoogleSetup: () => void;
  /** Asks before signing an account out. */
  onConfirmDisconnect: (service: SignInService, email?: string) => void;
};

/** Google's console pages for each step, in order. */
export const GOOGLE_SETUP_LINKS = {
  createProject: "https://console.cloud.google.com/projectcreate",
  enableApis:
    "https://console.cloud.google.com/flows/enableapi?apiid=gmail.googleapis.com,calendar-json.googleapis.com,drive.googleapis.com,people.googleapis.com,docs.googleapis.com,sheets.googleapis.com",
  consentScreen: "https://console.cloud.google.com/auth/overview",
  createClient: "https://console.cloud.google.com/auth/clients/create",
} as const;

const GOOGLE_AUDIENCE_URL = "https://console.cloud.google.com/auth/audience";

const BUSY_LABELS: Record<SignInBusy, string> = {
  installing: "Getting the tool ready…",
  "saving-file": "Saving your sign-in file…",
  starting: "Opening your browser…",
  cancelling: "Cancelling…",
  disconnecting: "Disconnecting…",
};

function externalLink(href: string, label: string): TemplateResult {
  return html`<a href=${href} target="_blank" rel="noopener noreferrer">${label}</a>`;
}

function renderNotice(notice: SignInNotice | undefined): TemplateResult | typeof nothing {
  return notice
    ? html`<p class="qs-connection__notice" data-tone=${notice.kind}>${notice.message}</p>`
    : nothing;
}

/** A sign-in in progress: where to finish it, and the link if no browser opened. */
function renderWaiting(
  job: SignInJobView,
  props: AccountSignInProps,
  hint: string,
): TemplateResult {
  return html`
    <div class="qs-connection__waiting" role="status" data-sign-in-waiting>
      <span class="qs-connection__spinner" aria-hidden="true"></span>
      <div class="qs-connection__waiting-text">
        <strong>Finish signing in in your browser.</strong>
        <span>${hint}</span>
        ${job.authUrl
          ? html`<button
              type="button"
              class="qs-connection__link-btn"
              @click=${() => props.onCopyLink(job.authUrl!)}
              title="If no browser window opened, paste this link into your browser"
            >
              Copy sign-in link
            </button>`
          : nothing}
      </div>
    </div>
  `;
}

function renderCancelButton(service: SignInService, props: AccountSignInProps): TemplateResult {
  const cancelling = props.busy[service] === "cancelling";
  return html`<button
    type="button"
    class="btn btn--sm"
    ?disabled=${cancelling}
    @click=${() => props.onCancel(service)}
  >
    ${cancelling ? BUSY_LABELS.cancelling : "Cancel"}
  </button>`;
}

function renderDisconnectButton(
  service: SignInService,
  props: AccountSignInProps,
  actions: SignInTileActions,
  email?: string,
): TemplateResult {
  const busy = props.busy[service];
  return html`<button
    type="button"
    class="btn btn--sm"
    ?disabled=${Boolean(busy)}
    @click=${() => actions.onConfirmDisconnect(service, email)}
  >
    ${busy === "disconnecting" ? BUSY_LABELS.disconnecting : "Disconnect"}
  </button>`;
}

/**
 * Signs a saved Google account in again. The client file is already saved, so
 * this is the same browser sign-in as the first time, for that address.
 */
function renderReconnectButton(props: AccountSignInProps, email: string): TemplateResult {
  const busy = props.busy.google;
  return html`<button
    type="button"
    class="btn btn--sm primary"
    ?disabled=${Boolean(busy)}
    @click=${() => {
      props.onGoogleEmailChange(email);
      props.onConnect("google");
    }}
  >
    ${busy === "installing" || busy === "starting" ? BUSY_LABELS[busy] : "Reconnect"}
  </button>`;
}

/**
 * Google ends a sign-in after 7 days while the user's Google app is in
 * "Testing". Publishing it is what stops the weekly sign-out.
 */
function renderWeeklyExpiryTip(): TemplateResult {
  return html`<p class="qs-connection__tip">
    Google signs you out every 7 days while your Google app is in testing. To stop that, open
    ${externalLink(GOOGLE_AUDIENCE_URL, "Audience")} in Google Cloud and choose Publish app.
  </p>`;
}

/** The status check itself failed: say so and offer to try again, never a blank tile. */
function renderCheckFailedTile(
  skillKey: string,
  label: string,
  logo: TemplateResult,
  props: AccountSignInProps,
): TemplateResult {
  return renderConnectionTile({
    skillKey,
    label,
    blurb: "Couldn't check this right now.",
    logo,
    status: "not-connected",
    statusText: "Unknown",
    action: html`<button type="button" class="btn btn--sm" @click=${() => props.onRefresh()}>
      Try again
    </button>`,
  });
}

function renderCheckingTile(
  skillKey: string,
  label: string,
  blurb: string,
  logo: TemplateResult,
): TemplateResult {
  return renderConnectionTile({
    skillKey,
    label,
    blurb,
    logo,
    status: "checking",
    statusText: "Checking…",
  });
}

function renderUnavailableTile(
  skillKey: string,
  label: string,
  logo: TemplateResult,
  message: string,
): TemplateResult {
  return renderConnectionTile({
    skillKey,
    label,
    blurb: message,
    logo,
    status: "unavailable",
    statusText: "Not available",
  });
}

export function renderGoogleSignInRow(
  props: AccountSignInProps,
  actions: SignInTileActions,
): TemplateResult {
  const skillKey = "gog";
  const label = "Google";
  const blurb = "Gmail, Calendar and Drive";
  const logo = WIZARD_SKILL_LOGOS.gog;
  if (props.unsupported) {
    return renderUnavailableTile(
      skillKey,
      label,
      logo,
      "Update Daisy to connect Google from here.",
    );
  }
  const google = props.status?.google;
  if (!google) {
    return props.loading
      ? renderCheckingTile(skillKey, label, blurb, logo)
      : renderCheckFailedTile(skillKey, label, logo, props);
  }
  const job = props.status?.jobs.google;
  const busy = props.busy.google;
  const notice = renderNotice(props.notice.google);
  if (job?.state === "running") {
    return renderConnectionTile({
      skillKey,
      label,
      blurb,
      logo,
      status: "waiting",
      statusText: "Waiting for you",
      action: renderCancelButton("google", props),
      body: html`${renderWaiting(
        job,
        props,
        "Pick your account and allow access. Google warns that the app isn't verified: it is your own app, so choose Advanced, then Continue.",
      )}${notice}`,
    });
  }
  const accounts = google.accounts;
  const expired = new Set(google.expiredAccounts ?? []);
  if (accounts.length === 1 && expired.has(accounts[0])) {
    return renderConnectionTile({
      skillKey,
      label,
      blurb: accounts[0],
      logo,
      status: "expired",
      statusText: "Sign-in expired",
      action: renderReconnectButton(props, accounts[0]),
      body: html`<p class="qs-connection__tip qs-connection__tip--lead">
          Google ended this sign-in, so Gmail, Calendar and Drive are paused. Reconnect to sign in
          again.
        </p>
        ${renderWeeklyExpiryTip()}${notice}`,
    });
  }
  if (accounts.length === 1) {
    return renderConnectionTile({
      skillKey,
      label,
      blurb: `Connected as ${accounts[0]}`,
      logo,
      status: "connected",
      statusText: "Connected",
      action: renderDisconnectButton("google", props, actions, accounts[0]),
      body: notice,
    });
  }
  if (accounts.length > 1) {
    const anyExpired = accounts.some((email) => expired.has(email));
    return renderConnectionTile({
      skillKey,
      label,
      blurb,
      logo,
      status: anyExpired ? "expired" : "connected",
      statusText: anyExpired ? "Sign-in expired" : "Connected",
      body: html`
        ${accounts.map((email) =>
          expired.has(email)
            ? html`
                <div class="qs-connection__account">
                  <span>Sign-in expired for <strong>${email}</strong></span>
                  ${renderReconnectButton(props, email)}
                </div>
              `
            : html`
                <div class="qs-connection__account">
                  <span>Connected as <strong>${email}</strong></span>
                  ${renderDisconnectButton("google", props, actions, email)}
                </div>
              `,
        )}
        ${anyExpired ? renderWeeklyExpiryTip() : nothing} ${notice}
      `,
    });
  }
  return renderConnectionTile({
    skillKey,
    label,
    blurb,
    logo,
    status: "not-connected",
    statusText: "Not connected",
    action: html`<button
      type="button"
      class="btn btn--sm primary"
      ?disabled=${Boolean(busy)}
      @click=${() => actions.onOpenGoogleSetup()}
    >
      ${busy === "installing" || busy === "starting" ? BUSY_LABELS[busy] : "Connect"}
    </button>`,
    body: notice,
  });
}

/** Google's setup steps, for the card that opens from the Google tile. */
export function renderGoogleSetupCard(props: AccountSignInProps): TemplateResult {
  const google = props.status?.google;
  // Until the status arrives, whether the file is saved is not known. Saying
  // "add the file" then was wrong for anyone who already had.
  const fileState: GoogleFileState = !google
    ? "checking"
    : google.hasClient && !props.replacingGoogleFile
      ? "saved"
      : "missing";
  return html`
    ${renderGoogleSetup(props, fileState)}
    ${props.notice.google
      ? html`<div class="qs-connect-dialog__notice">${renderNotice(props.notice.google)}</div>`
      : nothing}
    <div class="qs-connect-dialog__footer">
      <span>Prefer a hand? Daisy can walk you through it in a chat.</span>
      <button type="button" class="btn btn--sm" @click=${() => props.onSetUpWithDaisy("google")}>
        Set it up with Daisy
      </button>
    </div>
  `;
}

type GoogleFileState = "checking" | "saved" | "missing";

function renderGoogleFileStep(props: AccountSignInProps, fileState: GoogleFileState) {
  const busy = props.busy.google;
  if (fileState === "checking") {
    return html`<div class="qs-connection__file-done" aria-busy="true">
      Checking for your sign-in file…
    </div>`;
  }
  if (fileState === "saved") {
    return html`<div class="qs-connection__file-done">
      Your sign-in file is saved.
      <button
        type="button"
        class="qs-connection__link-btn"
        ?disabled=${Boolean(busy)}
        @click=${() => props.onReplaceGoogleFile()}
      >
        Use a different file
      </button>
    </div>`;
  }
  return html`<div class="qs-connection__file-row">
    <label class="qs-connection__file">
      <span class="btn btn--sm">
        ${busy === "saving-file" ? BUSY_LABELS["saving-file"] : "Add the downloaded file"}
      </span>
      <input
        type="file"
        accept=".json,application/json"
        ?disabled=${Boolean(busy)}
        data-google-client-file
        @change=${(event: Event) => {
          const input = event.target as HTMLInputElement;
          const file = input.files?.[0];
          input.value = "";
          if (file) {
            props.onGoogleClientFile(file);
          }
        }}
      />
    </label>
    ${props.replacingGoogleFile && props.status?.google.hasClient && props.onKeepGoogleFile
      ? html`<button
          type="button"
          class="qs-connection__link-btn"
          ?disabled=${Boolean(busy)}
          @click=${() => props.onKeepGoogleFile?.()}
        >
          Keep the saved file
        </button>`
      : nothing}
  </div>`;
}

function renderGoogleSetup(props: AccountSignInProps, fileState: GoogleFileState): TemplateResult {
  const busy = props.busy.google;
  const email = props.googleEmail.trim();
  const fileSaved = fileState === "saved";
  return html`
    <p class="qs-connection__note">
      Daisy signs in with your own Google sign-in app, so the login is yours alone. Making it takes
      about 15 minutes, once.
    </p>
    <ol class="qs-connection__steps" data-google-steps>
      <li class=${fileSaved ? "is-done" : ""}>
        ${externalLink(GOOGLE_SETUP_LINKS.createProject, "Create a Google Cloud project")}. Any name
        works, for example "Daisy".
      </li>
      <li class=${fileSaved ? "is-done" : ""}>
        ${externalLink(
          GOOGLE_SETUP_LINKS.enableApis,
          "Turn on Gmail, Calendar, Drive and the rest",
        )}
        for that project, then press Enable.
      </li>
      <li class=${fileSaved ? "is-done" : ""}>
        ${externalLink(GOOGLE_SETUP_LINKS.consentScreen, "Set up the sign-in screen")}: press Get
        started, give it a name, choose External and add your email. Then open Audience and press
        Publish app, or Google signs you out every 7 days.
      </li>
      <li class=${fileSaved ? "is-done" : ""}>
        ${externalLink(GOOGLE_SETUP_LINKS.createClient, "Create a sign-in client")}: choose Desktop
        app, press Create, then Download JSON. ${renderGoogleFileStep(props, fileState)}
      </li>
      <li>
        Sign in.
        <div class="qs-connection__fields">
          <label class="qs-connection__field">
            <span class="qs-connection__label">Your Google address</span>
            <input
              type="email"
              autocomplete="email"
              spellcheck="false"
              placeholder="name@gmail.com"
              data-google-email
              .value=${props.googleEmail}
              ?disabled=${Boolean(busy) || !fileSaved}
              @input=${(event: Event) =>
                props.onGoogleEmailChange((event.target as HTMLInputElement).value)}
            />
          </label>
          <button
            type="button"
            class="btn btn--sm primary"
            ?disabled=${Boolean(busy) || !fileSaved || !email}
            @click=${() => props.onConnect("google")}
          >
            ${busy === "installing" || busy === "starting" ? BUSY_LABELS[busy] : "Connect Google"}
          </button>
        </div>
      </li>
    </ol>
  `;
}

export function renderSpotifySignInRow(
  props: AccountSignInProps,
  actions: SignInTileActions,
): TemplateResult {
  const skillKey = "spotify-player";
  const label = "Spotify";
  const blurb = "Control your music. Needs Spotify Premium.";
  const logo = WIZARD_SKILL_LOGOS["spotify-player"];
  if (props.unsupported) {
    return renderUnavailableTile(
      skillKey,
      label,
      logo,
      "Update Daisy to connect Spotify from here.",
    );
  }
  const spotify = props.status?.spotify;
  if (!spotify) {
    return props.loading
      ? renderCheckingTile(skillKey, label, blurb, logo)
      : renderCheckFailedTile(skillKey, label, logo, props);
  }
  const job = props.status?.jobs.spotify;
  const busy = props.busy.spotify;
  const notice = renderNotice(props.notice.spotify);
  if (job?.state === "running") {
    return renderConnectionTile({
      skillKey,
      label,
      blurb,
      logo,
      status: "waiting",
      statusText: "Waiting for you",
      action: renderCancelButton("spotify", props),
      body: html`${renderWaiting(
        job,
        props,
        "Log in and press Agree. Spotify may ask twice: once for control, once for playback.",
      )}${notice}`,
    });
  }
  if (spotify.connected) {
    return renderConnectionTile({
      skillKey,
      label,
      blurb: "Control your music",
      logo,
      status: "connected",
      statusText: "Connected",
      action: renderDisconnectButton("spotify", props, actions),
      body: notice,
    });
  }
  return renderConnectionTile({
    skillKey,
    label,
    blurb,
    logo,
    status: "not-connected",
    statusText: "Not connected",
    action: html`<button
      type="button"
      class="btn btn--sm primary"
      title="Your browser opens Spotify's own login page"
      ?disabled=${Boolean(busy)}
      @click=${() => props.onConnect("spotify")}
    >
      ${busy === "installing" || busy === "starting" ? BUSY_LABELS[busy] : "Connect"}
    </button>`,
    body: notice,
  });
}
