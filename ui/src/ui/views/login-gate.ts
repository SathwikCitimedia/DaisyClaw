// Control UI view renders login gate screen content.
import { html } from "lit";
import { ConnectErrorDetailCodes } from "../../../../packages/gateway-protocol/src/connect-error-details.js";
import { t } from "../../i18n/index.ts";
import type { AppViewState } from "../app-view-state.ts";
import { isConsumerBuild } from "../consumer-build.ts";
import { buildExternalLinkRel, EXTERNAL_LINK_TARGET } from "../external-link.ts";
import { icons } from "../icons.ts";
import { normalizeBasePath } from "../navigation.ts";
import { normalizeLowercaseStringOrEmpty } from "../string-coerce.ts";
import { agentLogoUrl } from "./agents-utils.ts";
import { renderConnectCommand } from "./connect-command.ts";
import {
  resolveAuthHintKind,
  resolvePairingHint,
  shouldShowInsecureContextHint,
} from "./overview-hints.ts";

type LoginFailureKind =
  | "auth-required"
  | "auth-failed"
  | "auth-rate-limited"
  | "pairing-required"
  | "insecure-context"
  | "origin-not-allowed"
  | "protocol-mismatch"
  | "network";

export type LoginFailureFeedback = {
  kind: LoginFailureKind;
  title: string;
  summary: string;
  steps: string[];
  docsHref: string;
  docsLabel: string;
  rawError: string;
};

type LoginFailureFeedbackParams = {
  connected: boolean;
  lastError: string | null;
  lastErrorCode?: string | null;
  hasToken: boolean;
  hasPassword: boolean;
};

function resolveDocsLabel(href: string): string {
  if (href.includes("insecure-http")) {
    return t("login.failure.docsInsecure");
  }
  if (href.includes("device-pairing")) {
    return t("login.failure.docsPairing");
  }
  return t("login.failure.docsAuth");
}

function redactLoginFailureError(value: string): string {
  return value
    .replace(
      /([?#&])(?:access_token|auth|deviceToken|password|refresh_token|token)=([^&#\s]+)/gi,
      "$1[redacted-credential]",
    )
    .replace(/\bBearer\s+([A-Za-z0-9._~+/-]+=*)/gi, "Bearer [redacted]")
    .replace(
      /(["']?(?:access|accessToken|deviceToken|password|refresh|refreshToken|token)["']?\s*[:=]\s*)["']?[^"',\s}]+/gi,
      "$1[redacted]",
    );
}

function buildFeedback(params: {
  kind: LoginFailureKind;
  rawError: string;
  docsHref?: string;
  titleKey: string;
  summaryKey: string;
  stepKeys: string[];
  stepParams?: Record<string, string>;
}): LoginFailureFeedback {
  const docsHref = params.docsHref ?? "https://docs.daisyclaw.ai/web/dashboard";
  return {
    kind: params.kind,
    title: t(params.titleKey, params.stepParams),
    summary: t(params.summaryKey, params.stepParams),
    steps: params.stepKeys.map((key) => t(key, params.stepParams)),
    docsHref,
    docsLabel: resolveDocsLabel(docsHref),
    rawError: redactLoginFailureError(params.rawError),
  };
}

export function resolveLoginFailureFeedback(
  params: LoginFailureFeedbackParams,
): LoginFailureFeedback | null {
  if (params.connected || !params.lastError) {
    return null;
  }

  const rawError = params.lastError;
  const lastErrorCode = params.lastErrorCode ?? null;
  const lower = normalizeLowercaseStringOrEmpty(rawError);

  const pairing = resolvePairingHint(false, rawError, lastErrorCode);
  if (pairing) {
    return buildFeedback({
      kind: "pairing-required",
      rawError,
      docsHref: "https://docs.daisyclaw.ai/web/control-ui#device-pairing-first-connection",
      titleKey:
        pairing.kind === "scope-upgrade-pending"
          ? "login.failure.pairing.scopeTitle"
          : pairing.kind === "role-upgrade-pending"
            ? "login.failure.pairing.roleTitle"
            : pairing.kind === "metadata-upgrade-pending"
              ? "login.failure.pairing.metadataTitle"
              : "login.failure.pairing.title",
      summaryKey:
        pairing.kind === "pairing-required"
          ? "login.failure.pairing.summary"
          : "login.failure.pairing.upgradeSummary",
      stepKeys: [
        "login.failure.pairing.stepList",
        pairing.requestId
          ? "login.failure.pairing.stepApproveId"
          : "login.failure.pairing.stepApprove",
        "login.failure.pairing.stepReconnect",
      ],
      stepParams: { requestId: pairing.requestId ?? "" },
    });
  }

  if (
    lastErrorCode === ConnectErrorDetailCodes.AUTH_RATE_LIMITED ||
    lower.includes("too many failed authentication attempts") ||
    lower.includes("rate limit")
  ) {
    return buildFeedback({
      kind: "auth-rate-limited",
      rawError,
      titleKey: "login.failure.rateLimited.title",
      summaryKey: "login.failure.rateLimited.summary",
      stepKeys: [
        "login.failure.rateLimited.stepStop",
        "login.failure.rateLimited.stepWait",
        "login.failure.rateLimited.stepCheckClients",
      ],
    });
  }

  if (shouldShowInsecureContextHint(false, rawError, lastErrorCode)) {
    return buildFeedback({
      kind: "insecure-context",
      rawError,
      docsHref: "https://docs.daisyclaw.ai/web/control-ui#insecure-http",
      titleKey: "login.failure.insecure.title",
      summaryKey: "login.failure.insecure.summary",
      stepKeys: [
        "login.failure.insecure.stepHttps",
        "login.failure.insecure.stepLocalCompat",
        "login.failure.insecure.stepAvoidDisable",
      ],
    });
  }

  if (
    lastErrorCode === ConnectErrorDetailCodes.CONTROL_UI_ORIGIN_NOT_ALLOWED ||
    lower.includes("origin not allowed")
  ) {
    return buildFeedback({
      kind: "origin-not-allowed",
      rawError,
      docsHref:
        "https://docs.daisyclaw.ai/web/control-ui#debuggingtesting-dev-server--remote-gateway",
      titleKey: "login.failure.origin.title",
      summaryKey: "login.failure.origin.summary",
      stepKeys: [
        "login.failure.origin.stepAllowedOrigins",
        "login.failure.origin.stepFullOrigin",
        "login.failure.origin.stepRestart",
      ],
    });
  }

  if (lower.includes("protocol mismatch")) {
    return buildFeedback({
      kind: "protocol-mismatch",
      rawError,
      docsHref:
        "https://docs.daisyclaw.ai/web/control-ui#debuggingtesting-dev-server--remote-gateway",
      titleKey: "login.failure.protocol.title",
      summaryKey: "login.failure.protocol.summary",
      stepKeys: [
        "login.failure.protocol.stepDashboard",
        "login.failure.protocol.stepDevUi",
        "login.failure.protocol.stepRestart",
      ],
    });
  }

  const authHintKind = resolveAuthHintKind({
    connected: false,
    lastError: rawError,
    lastErrorCode,
    hasToken: params.hasToken,
    hasPassword: params.hasPassword,
  });
  if (authHintKind === "required") {
    return buildFeedback({
      kind: "auth-required",
      rawError,
      titleKey: "login.failure.authRequired.title",
      summaryKey: "login.failure.authRequired.summary",
      stepKeys: [
        "login.failure.authRequired.stepPaste",
        "login.failure.authRequired.stepGenerate",
        "login.failure.authRequired.stepConnect",
      ],
    });
  }
  if (authHintKind === "failed") {
    return buildFeedback({
      kind: "auth-failed",
      rawError,
      titleKey: "login.failure.authFailed.title",
      summaryKey: "login.failure.authFailed.summary",
      stepKeys: [
        "login.failure.authFailed.stepDashboard",
        "login.failure.authFailed.stepReplace",
        "login.failure.authFailed.stepMode",
      ],
    });
  }

  return buildFeedback({
    kind: "network",
    rawError,
    titleKey: "login.failure.network.title",
    summaryKey: "login.failure.network.summary",
    stepKeys: [
      "login.failure.network.stepGateway",
      "login.failure.network.stepUrl",
      "login.failure.network.stepDashboard",
    ],
  });
}

function renderLoginFailure(feedback: LoginFailureFeedback) {
  return html`
    <div
      class="callout danger login-gate__failure"
      role="alert"
      aria-live="polite"
      data-kind=${feedback.kind}
    >
      <div class="login-gate__failure-title">${feedback.title}</div>
      <div class="login-gate__failure-summary">${feedback.summary}</div>
      <ol class="login-gate__failure-steps">
        ${feedback.steps.map((step) => html`<li>${step}</li>`)}
      </ol>
      <details class="login-gate__failure-detail">
        <summary>${t("login.failure.rawError")}</summary>
        <div class="login-gate__failure-raw mono">${feedback.rawError}</div>
      </details>
      <a
        class="session-link login-gate__failure-docs"
        href=${feedback.docsHref}
        target=${EXTERNAL_LINK_TARGET}
        rel=${buildExternalLinkRel()}
        >${feedback.docsLabel}</a
      >
    </div>
  `;
}

/**
 * How long a dropped connection is shown as "reconnecting" before the login
 * form takes over. Gateway restarts after a config save take seconds; a cold
 * start on a slow PC can take a couple of minutes.
 */
export const RECONNECT_GRACE_MS = 3 * 60_000;

/**
 * True while the browser client is auto-reconnecting to a gateway it was
 * connected to (or has a token for) and the failure is a plain transport
 * failure — not an auth/pairing/origin problem the user must act on.
 */
export function shouldShowReconnectingGate(
  state: Pick<
    AppViewState,
    | "connected"
    | "disconnectedAtMs"
    | "loginGateRequested"
    | "lastError"
    | "lastErrorCode"
    | "settings"
    | "password"
  >,
  nowMs: number = Date.now(),
): boolean {
  if (state.connected || state.loginGateRequested) {
    return false;
  }
  if (state.disconnectedAtMs == null || nowMs - state.disconnectedAtMs >= RECONNECT_GRACE_MS) {
    return false;
  }
  if (!state.settings.token.trim() && !state.password.trim()) {
    return false;
  }
  const failure = resolveLoginFailureFeedback({
    connected: false,
    lastError: state.lastError,
    lastErrorCode: state.lastErrorCode,
    hasToken: Boolean(state.settings.token.trim()),
    hasPassword: Boolean(state.password.trim()),
  });
  return failure === null || failure.kind === "network";
}

/**
 * True while the very first connection attempt is still in flight.
 *
 * The desktop app opens the dashboard as soon as the engine is up, and the page
 * renders before its socket has finished connecting. With nothing to say yet,
 * the app used to render the login form for those few seconds, so a consumer
 * who never has to log in was asked to, on every cold start. There is nothing
 * for the user to do here, so show the same quiet card the app uses elsewhere
 * while it waits. A failed attempt sets `disconnectedAtMs`, which hands the
 * decision on to the reconnecting gate and, eventually, to the login form.
 */
export function shouldShowConnectingGate(
  state: Pick<
    AppViewState,
    "connected" | "disconnectedAtMs" | "loginGateRequested" | "lastError" | "settings" | "password"
  >,
): boolean {
  if (state.connected || state.loginGateRequested) {
    return false;
  }
  if (state.disconnectedAtMs != null || state.lastError) {
    return false;
  }
  return Boolean(state.settings.token.trim() || state.password.trim());
}

/**
 * In the packaged consumer build the desktop app owns the credentials, so a
 * connection the app cannot make is never something the user can type their
 * way out of. Instead of the developer login form (gateway address, token,
 * terminal commands) the consumer sees a plain card that says what is wrong
 * in their terms and offers a retry; the app repairs the credentials on its
 * side and re-opens the window with a fresh address.
 */
export function shouldShowConsumerGate(
  state: Pick<AppViewState, "connected">,
  consumerBuild: boolean = isConsumerBuild(),
): boolean {
  return consumerBuild && !state.connected;
}

type ConsumerGateTone = "sign-in" | "offline" | "pairing";

function resolveConsumerGateTone(failure: LoginFailureFeedback | null): ConsumerGateTone {
  if (failure === null || failure.kind === "network") {
    return "offline";
  }
  if (failure.kind === "pairing-required") {
    return "pairing";
  }
  return "sign-in";
}

export function renderConsumerGate(state: AppViewState) {
  const basePath = normalizeBasePath(state.basePath ?? "");
  const faviconSrc = agentLogoUrl(basePath);
  const failure = resolveLoginFailureFeedback({
    connected: state.connected,
    lastError: state.lastError,
    lastErrorCode: state.lastErrorCode,
    hasToken: Boolean(state.settings.token.trim()),
    hasPassword: Boolean(state.password.trim()),
  });
  const tone = resolveConsumerGateTone(failure);
  const showDetails = state.loginGateRequested && failure !== null;
  return html`
    <div class="login-gate" data-consumer="true" data-tone=${tone}>
      <div class="login-gate__card login-gate__card--reconnecting" role="status" aria-live="polite">
        <div class="login-gate__header">
          <img class="login-gate__logo" src=${faviconSrc} alt="Daisy" />
          ${tone === "pairing"
            ? html`<div class="login-gate__spinner" aria-hidden="true"></div>`
            : ""}
          <div class="login-gate__title">${t(`login.consumer.${tone}.title`)}</div>
          <div class="login-gate__sub">${t(`login.consumer.${tone}.summary`)}</div>
        </div>
        <div class="login-gate__consumer-actions">
          <button
            type="button"
            class="btn primary login-gate__connect"
            @click=${() => state.connect()}
          >
            ${t("login.consumer.retry")}
          </button>
          ${failure
            ? html`
                <button
                  type="button"
                  class="btn login-gate__details-btn"
                  aria-expanded=${showDetails}
                  @click=${() => {
                    state.loginGateRequested = !state.loginGateRequested;
                  }}
                >
                  ${showDetails ? t("login.consumer.hideDetails") : t("login.consumer.showDetails")}
                </button>
              `
            : ""}
        </div>
        ${showDetails && failure
          ? html`<pre class="login-gate__consumer-details mono">${failure.rawError}</pre>`
          : ""}
      </div>
    </div>
  `;
}

export function renderReconnectingGate(state: AppViewState, nowMs: number = Date.now()) {
  const basePath = normalizeBasePath(state.basePath ?? "");
  const faviconSrc = agentLogoUrl(basePath);
  const elapsedSeconds =
    state.disconnectedAtMs == null
      ? 0
      : Math.max(0, Math.floor((nowMs - state.disconnectedAtMs) / 1000));
  const slow = elapsedSeconds >= 45;
  return html`
    <div class="login-gate" data-reconnecting="true">
      <div class="login-gate__card login-gate__card--reconnecting" role="status" aria-live="polite">
        <div class="login-gate__header">
          <img class="login-gate__logo" src=${faviconSrc} alt="Daisy" />
          <div class="login-gate__spinner" aria-hidden="true"></div>
          <div class="login-gate__title">${t("login.reconnecting.title")}</div>
          <div class="login-gate__sub">
            ${slow ? t("login.reconnecting.slow") : t("login.reconnecting.summary")}
          </div>
          <div class="login-gate__elapsed mono">
            ${t("login.reconnecting.waiting")} ${elapsedSeconds}s
          </div>
        </div>
        <button
          type="button"
          class="btn login-gate__details-btn"
          @click=${() => {
            state.loginGateRequested = true;
          }}
        >
          ${t("login.reconnecting.details")}
        </button>
      </div>
    </div>
  `;
}

/**
 * What the app is genuinely waiting for. Each stage is driven by a real signal,
 * not a timer: "starting" means the socket is not open yet, "loading" means it
 * is open and the first-run decision is still in flight.
 */
export type PreparingStage = "starting" | "loading";

/** After this long, say why it is taking so long instead of just spinning. */
const PREPARING_SLOW_AFTER_MS = 20_000;

let preparingSinceMs: number | null = null;

/** Test seam: forget when waiting started. */
export function resetPreparingClockForTest(): void {
  preparingSinceMs = null;
}

/**
 * The words for a stage. Kept pure so the copy can be tested without rendering:
 * a spinner with no explanation is what made people think the app had frozen.
 */
export function describePreparingStage(params: { stage: PreparingStage; elapsedMs: number }): {
  title: string;
  summary: string;
  slow: boolean;
} {
  const slow = params.elapsedMs >= PREPARING_SLOW_AFTER_MS;
  if (params.stage === "loading") {
    return {
      title: t("login.preparing.loadingTitle"),
      summary: t("login.preparing.loadingSummary"),
      slow,
    };
  }
  return {
    title: t("login.preparing.startingTitle"),
    summary: slow ? t("login.preparing.slow") : t("login.preparing.startingSummary"),
    slow,
  };
}

/**
 * Shown while the app is still coming up: first waiting for the engine, then
 * while it decides whether this is a fresh install (one config.get). Keeps the
 * dashboard from flashing before the wizard replaces it on slow machines.
 *
 * It used to show one unchanging line and a spinner for up to a minute, and
 * several minutes on a cold laptop, so people concluded it had hung. It now
 * names the stage it is actually on, and says why a first start is slow.
 */
export function renderPreparingGate(
  state: AppViewState,
  opts?: { stage?: PreparingStage; nowMs?: number },
) {
  const basePath = normalizeBasePath(state.basePath ?? "");
  const faviconSrc = agentLogoUrl(basePath);
  const nowMs = opts?.nowMs ?? Date.now();
  preparingSinceMs ??= nowMs;
  const copy = describePreparingStage({
    stage: opts?.stage ?? "starting",
    elapsedMs: Math.max(0, nowMs - preparingSinceMs),
  });
  return html`
    <div class="login-gate" data-preparing="true" data-stage=${opts?.stage ?? "starting"}>
      <div class="login-gate__card login-gate__card--reconnecting" role="status" aria-live="polite">
        <div class="login-gate__header">
          <img class="login-gate__logo" src=${faviconSrc} alt="Daisy" />
          <div class="login-gate__spinner" aria-hidden="true"></div>
          <div class="login-gate__title">${copy.title}</div>
          <div class="login-gate__sub">${copy.summary}</div>
        </div>
      </div>
    </div>
  `;
}

/** Full-screen card shown from "Erase everything" until the fresh gateway is back. */
export function renderResettingGate(state: AppViewState, opts?: { slow?: boolean }) {
  const basePath = normalizeBasePath(state.basePath ?? "");
  const faviconSrc = agentLogoUrl(basePath);
  return html`
    <div class="login-gate" data-resetting="true">
      <div class="login-gate__card login-gate__card--reconnecting" role="status" aria-live="polite">
        <div class="login-gate__header">
          <img class="login-gate__logo" src=${faviconSrc} alt="Daisy" />
          <div class="login-gate__spinner" aria-hidden="true"></div>
          <div class="login-gate__title">${t("login.resetting.title")}</div>
          <div class="login-gate__sub">
            ${opts?.slow ? t("login.resetting.slow") : t("login.resetting.summary")}
          </div>
        </div>
      </div>
    </div>
  `;
}

export function renderLoginGate(state: AppViewState) {
  const basePath = normalizeBasePath(state.basePath ?? "");
  const faviconSrc = agentLogoUrl(basePath);
  const failure = resolveLoginFailureFeedback({
    connected: state.connected,
    lastError: state.lastError,
    lastErrorCode: state.lastErrorCode,
    hasToken: Boolean(state.settings.token.trim()),
    hasPassword: Boolean(state.password.trim()),
  });

  return html`
    <div class="login-gate">
      <div class="login-gate__card">
        <div class="login-gate__header">
          <img class="login-gate__logo" src=${faviconSrc} alt="DaisyClaw" />
          <div class="login-gate__title">DaisyClaw</div>
          <div class="login-gate__sub">${t("login.subtitle")}</div>
        </div>
        <div class="login-gate__form">
          <label class="field">
            <span>${t("overview.access.wsUrl")}</span>
            <input
              .value=${state.settings.gatewayUrl}
              @input=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value;
                state.applySettings({ ...state.settings, gatewayUrl: v });
              }}
              placeholder="ws://127.0.0.1:18789"
            />
          </label>
          <label class="field">
            <span>${t("overview.access.token")}</span>
            <div class="login-gate__secret-row">
              <input
                type=${state.loginShowGatewayToken ? "text" : "password"}
                autocomplete="off"
                spellcheck="false"
                .value=${state.settings.token}
                @input=${(e: Event) => {
                  const v = (e.target as HTMLInputElement).value;
                  state.applySettings({ ...state.settings, token: v });
                }}
                placeholder="DAISYCLAW_GATEWAY_TOKEN (${t("login.passwordPlaceholder")})"
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter") {
                    state.connect();
                  }
                }}
              />
              <button
                type="button"
                class="btn btn--icon ${state.loginShowGatewayToken ? "active" : ""}"
                title=${state.loginShowGatewayToken ? t("login.hideToken") : t("login.showToken")}
                aria-label=${t("login.toggleTokenVisibility")}
                aria-pressed=${state.loginShowGatewayToken}
                @click=${() => {
                  state.loginShowGatewayToken = !state.loginShowGatewayToken;
                }}
              >
                ${state.loginShowGatewayToken ? icons.eye : icons.eyeOff}
              </button>
            </div>
          </label>
          <label class="field">
            <span>${t("overview.access.password")}</span>
            <div class="login-gate__secret-row">
              <input
                type=${state.loginShowGatewayPassword ? "text" : "password"}
                autocomplete="off"
                spellcheck="false"
                .value=${state.password}
                @input=${(e: Event) => {
                  const v = (e.target as HTMLInputElement).value;
                  state.password = v;
                }}
                placeholder="${t("login.passwordPlaceholder")}"
                @keydown=${(e: KeyboardEvent) => {
                  if (e.key === "Enter") {
                    state.connect();
                  }
                }}
              />
              <button
                type="button"
                class="btn btn--icon ${state.loginShowGatewayPassword ? "active" : ""}"
                title=${state.loginShowGatewayPassword
                  ? t("login.hidePassword")
                  : t("login.showPassword")}
                aria-label=${t("login.togglePasswordVisibility")}
                aria-pressed=${state.loginShowGatewayPassword}
                @click=${() => {
                  state.loginShowGatewayPassword = !state.loginShowGatewayPassword;
                }}
              >
                ${state.loginShowGatewayPassword ? icons.eye : icons.eyeOff}
              </button>
            </div>
          </label>
          <button class="btn primary login-gate__connect" @click=${() => state.connect()}>
            ${t("common.connect")}
          </button>
        </div>
        ${failure ? renderLoginFailure(failure) : ""}
        <div class="login-gate__help">
          <div class="login-gate__help-title">${t("overview.connection.title")}</div>
          <ol class="login-gate__steps">
            <li>
              ${t("overview.connection.step1")}${renderConnectCommand("daisyclaw gateway run")}
            </li>
            <li>
              ${t("overview.connection.step2")} ${renderConnectCommand("daisyclaw dashboard")}
            </li>
            <li>${t("overview.connection.step3")}</li>
          </ol>
          <div class="login-gate__docs">
            <a
              class="session-link"
              href="https://docs.daisyclaw.ai/web/dashboard"
              target="_blank"
              rel="noreferrer"
              >${t("overview.connection.docsLink")}</a
            >
          </div>
        </div>
      </div>
    </div>
  `;
}
