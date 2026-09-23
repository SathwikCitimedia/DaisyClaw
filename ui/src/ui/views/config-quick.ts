/**
 * Quick Settings view — opinionated card layout for the most common settings.
 * Replaces the raw schema-driven form as the default settings experience.
 *
 * Each card answers a "what do I want to do?" question with status + actions.
 */

import { html, nothing, type TemplateResult } from "lit";
import { t } from "../../i18n/index.ts";
import { isConsumerBuild } from "../consumer-build.ts";
import { icons } from "../icons.ts";
import type { BorderRadiusStop, TextScaleStop } from "../storage.ts";
import { normalizeOptionalString } from "../string-coerce.ts";
import type { ThemeTransitionContext } from "../theme-transition.ts";
import type { ThemeMode } from "../theme.ts";
import type { SkillStatusEntry } from "../types.ts";
import {
  normalizeLocalUserIdentity,
  resolveLocalUserAvatarText,
  resolveLocalUserAvatarUrl,
} from "../user-identity.ts";
import {
  assistantAvatarFallbackUrl,
  resolveChatAvatarRenderUrl,
  resolveAssistantTextAvatar,
} from "./agents-utils.ts";
import { renderChannelBrandIcon } from "./channels.icons.ts";
import {
  CONFIG_PRESETS,
  detectActivePreset,
  getPresetById,
  type ConfigPresetId,
} from "./config-presets.ts";
import { renderConnectionsCard, type ConnectionDefinition } from "./connections.ts";

// Outline icons for the context-profile preset cards (replaces the emoji
// stored on each preset definition).
const PRESET_ICONS: Record<ConfigPresetId, TemplateResult> = {
  personal: icons.sparkles,
  codeAgent: icons.code,
  teamBot: icons.users,
  minimal: icons.zap,
};

// ── Types ──

export type QuickSettingsChannel = {
  id: string;
  label: string;
  connected: boolean;
  detail?: string;
  requests?: number;
};

export type QuickSettingsAutomation = {
  cronJobCount: number;
  skillCount: number;
  mcpServerCount: number;
};

export type QuickSettingsSecurity = {
  gatewayAuth: string;
  execPolicy: string;
  deviceAuth: boolean;
  browserEnabled: boolean;
  toolProfile: string;
};

export type QuickSettingsProps = {
  // Model & Thinking
  currentModel: string;
  thinkingLevel: string;
  fastMode: boolean;
  /** False when the active model offers no thinking level beyond "off". */
  thinkingSupported?: boolean;
  /** False when the active provider ignores fast mode (non-Anthropic). */
  fastModeSupported?: boolean;
  onModelChange?: () => void;
  onThinkingChange?: (level: string) => void;
  onFastModeToggle?: () => void;

  // Channels
  channels: QuickSettingsChannel[];
  onAddChannel?: () => void;
  onChannelConfigure?: (channelId: string) => void;
  onChannelConnect?: (channelId: string) => void;
  channelConnectBusy?: string | null;
  onChannelDisconnect?: (channelId: string) => void;
  channelDisconnectBusy?: string | null;

  // Automations
  automation: QuickSettingsAutomation;
  onManageCron?: () => void;
  onBrowseSkills?: () => void;
  onConfigureMcp?: () => void;

  // Security
  security: QuickSettingsSecurity;
  onSecurityConfigure?: () => void;
  onBrowserEnabledToggle?: (enabled: boolean) => void;
  onToolProfileChange?: (profile: string) => void;

  // Appearance
  themeMode: ThemeMode;
  borderRadius: number;
  textScale: number;
  setThemeMode: (mode: ThemeMode, context?: ThemeTransitionContext) => void;
  setBorderRadius: (value: number) => void;
  setTextScale: (value: number) => void;
  userAvatar?: string | null;
  onUserAvatarChange?: (next: string | null) => void;

  // Presets
  configObject?: Record<string, unknown>;
  savedConfigObject?: Record<string, unknown>;
  configDirty?: boolean;
  configSaving?: boolean;
  configApplying?: boolean;
  configReady?: boolean;
  onSelectPreset?: (presetId: ConfigPresetId) => void;
  onResetConfig?: () => void;
  onSaveConfig?: () => void;
  onApplyConfig?: () => void;

  // Navigation
  onAdvancedSettings?: () => void;

  // Reset / start over
  /** Re-open the guided first-run setup without erasing anything. */
  onRunSetupAgain?: () => void;
  /** Whether the "what happens" card is expanded. */
  resetOpen?: boolean;
  onResetOpenChange?: (open: boolean) => void;
  /** Whether the "I understand" box is ticked. */
  resetAcknowledged?: boolean;
  onResetAcknowledgedChange?: (acknowledged: boolean) => void;
  /** Erase everything and restart into the wizard. */
  onFactoryReset?: () => void;
  factoryResetBusy?: boolean;

  // Diagnostics
  /** Writes a redacted support bundle and reports where it landed. */
  onCreateSupportBundle?: () => void;
  supportBundleBusy?: boolean;

  // Connections
  connectionSkills?: readonly SkillStatusEntry[];
  connectionDrafts?: Readonly<Record<string, string>>;
  connectionBusyKey?: string | null;
  connectionNotice?: { skillKey: string; kind: "success" | "error"; message: string } | null;
  onConnectionDraftChange?: (env: string, value: string) => void;
  onConnectAccount?: (definition: ConnectionDefinition) => void;

  // Spending
  /** Spent so far this calendar month, in dollars. */
  spendingThisMonthUsd?: number | null;
  /** The ceiling the user set, or null for none. */
  spendingLimitUsd?: number | null;
  /** True once the ceiling stopped Daisy making paid requests. */
  spendingExceeded?: boolean;
  onSpendingLimitChange?: (limitUsd: number | null) => void;
  supportBundleResult?: { ok: boolean; message: string } | null;

  // Connection
  connected: boolean;
  gatewayUrl: string;
  assistantName: string;
  assistantAvatar?: string | null;
  assistantAvatarUrl?: string | null;
  assistantAvatarSource?: string | null;
  assistantAvatarStatus?: "none" | "local" | "remote" | "data" | null;
  assistantAvatarReason?: string | null;
  assistantAvatarOverride?: string | null;
  assistantAvatarUploadBusy?: boolean;
  assistantAvatarUploadError?: string | null;
  onAssistantAvatarOverrideChange?: (dataUrl: string) => void | Promise<void>;
  onAssistantAvatarClearOverride?: () => void | Promise<void>;
  basePath?: string | null;
  version: string;
};

const BORDER_RADIUS_STOPS: Array<{ value: BorderRadiusStop; label: string }> = [
  { value: 0, label: "None" },
  { value: 25, label: "Slight" },
  { value: 50, label: "Default" },
  { value: 75, label: "Round" },
  { value: 100, label: "Full" },
];

const TEXT_SCALE_OPTIONS: Array<{ value: TextScaleStop; label: string }> = [
  { value: 90, label: "S" },
  { value: 100, label: "M" },
  { value: 110, label: "L" },
  { value: 125, label: "XL" },
  { value: 140, label: "XXL" },
];

const THINKING_LEVELS = ["off", "low", "medium", "high"];
const TOOL_PROFILES = ["minimal", "coding", "messaging", "full"];
const LOCAL_USER_LABEL = "You";
// Keep raw uploads comfortably below the 2 MB persisted data URL limit after
// base64 expansion and a small MIME/header prefix are added.
const MAX_LOCAL_USER_AVATAR_FILE_BYTES = 1_500_000;
const MAX_ASSISTANT_AVATAR_UPLOAD_BYTES = MAX_LOCAL_USER_AVATAR_FILE_BYTES;

function renderDefaultUserAvatar() {
  return html`
    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
      <circle cx="12" cy="8" r="4" />
      <path d="M20 21a8 8 0 1 0-16 0" />
    </svg>
  `;
}

function renderLocalUserAvatarPreview(avatar: string | null | undefined) {
  const identity = normalizeLocalUserIdentity({ name: null, avatar });
  const avatarUrl = resolveLocalUserAvatarUrl(identity);
  const avatarText = resolveLocalUserAvatarText(identity);
  if (avatarUrl) {
    return html`<img class="qs-user-avatar" src=${avatarUrl} alt=${LOCAL_USER_LABEL} />`;
  }
  if (avatarText) {
    return html`<div class="qs-user-avatar qs-user-avatar--text" aria-label=${LOCAL_USER_LABEL}>
      ${avatarText}
    </div>`;
  }
  return html`
    <div class="qs-user-avatar qs-user-avatar--default" aria-label=${LOCAL_USER_LABEL}>
      ${renderDefaultUserAvatar()}
    </div>
  `;
}

function resolveAssistantPreviewAvatarUrl(props: QuickSettingsProps): string | null {
  const override = normalizeOptionalString(props.assistantAvatarOverride);
  if (override) {
    return resolveChatAvatarRenderUrl(override, {
      identity: {
        avatar: override,
        avatarUrl: override,
      },
    });
  }
  if (props.assistantAvatarStatus === "none" && props.assistantAvatarReason === "missing") {
    return null;
  }
  return resolveChatAvatarRenderUrl(props.assistantAvatarUrl, {
    identity: {
      avatar: props.assistantAvatar ?? undefined,
      avatarUrl: props.assistantAvatarUrl ?? undefined,
    },
  });
}

function formatAssistantAvatarSource(value: string | null | undefined): string | null {
  const source = normalizeOptionalString(value);
  if (!source) {
    return null;
  }
  if (/^data:image\//i.test(source)) {
    const header = source.slice(0, source.indexOf(",") > 0 ? source.indexOf(",") : 32);
    return `${header},...`;
  }
  return source.length > 72 ? `${source.slice(0, 34)}...${source.slice(-24)}` : source;
}

function formatAssistantAvatarIssue(
  status: QuickSettingsProps["assistantAvatarStatus"],
  reason: string | null | undefined,
  _rendered: boolean,
  hasOverride = false,
): string | null {
  if (hasOverride) {
    return null;
  }
  if (status === "remote") {
    return "Remote URLs are blocked by Control UI image policy";
  }
  if (reason === "missing") {
    return "File not found";
  }
  if (reason === "unsupported_extension") {
    return "Unsupported image type";
  }
  if (reason === "outside_workspace") {
    return "Outside workspace";
  }
  if (reason === "too_large") {
    return "Image is too large";
  }
  return reason ? "Cannot render avatar" : null;
}

function renderAssistantAvatarPreview(props: QuickSettingsProps) {
  const assistantName = normalizeOptionalString(props.assistantName) ?? "Assistant";
  const assistantAvatarOverride = normalizeOptionalString(props.assistantAvatarOverride);
  const assistantAvatarUrl = resolveAssistantPreviewAvatarUrl(props);
  if (assistantAvatarUrl) {
    return html`<img class="qs-assistant-avatar" src=${assistantAvatarUrl} alt=${assistantName} />`;
  }
  const assistantAvatarText = resolveAssistantTextAvatar(
    assistantAvatarOverride ?? props.assistantAvatar,
  );
  if (assistantAvatarText) {
    return html`<div
      class="qs-assistant-avatar qs-assistant-avatar--text"
      aria-label=${assistantName}
    >
      ${assistantAvatarText}
    </div>`;
  }
  return html`
    <img
      class="qs-assistant-avatar qs-assistant-avatar--fallback"
      src=${assistantAvatarFallbackUrl(props.basePath ?? "")}
      alt=${assistantName}
    />
  `;
}

function handleLocalUserAvatarFileSelect(e: Event, props: QuickSettingsProps) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  const onUserAvatarChange = props.onUserAvatarChange;
  if (!file || !onUserAvatarChange) {
    input.value = "";
    return;
  }
  if (!file.type.startsWith("image/")) {
    input.value = "";
    return;
  }
  if (file.size > MAX_LOCAL_USER_AVATAR_FILE_BYTES) {
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    onUserAvatarChange(typeof reader.result === "string" ? reader.result : null);
  });
  reader.readAsDataURL(file);
  input.value = "";
}

function handleAssistantAvatarFileSelect(e: Event, props: QuickSettingsProps) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  const onAssistantAvatarOverrideChange = props.onAssistantAvatarOverrideChange;
  if (!file || !onAssistantAvatarOverrideChange) {
    input.value = "";
    return;
  }
  if (file.size > MAX_ASSISTANT_AVATAR_UPLOAD_BYTES) {
    input.value = "";
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    const result = typeof reader.result === "string" ? reader.result : "";
    if (result) {
      void onAssistantAvatarOverrideChange(result);
    }
  });
  reader.readAsDataURL(file);
  input.value = "";
}

type ProfileSettings = {
  bootstrapMaxChars: number;
  bootstrapTotalMaxChars: number;
  contextInjection: "always" | "continuation-skip";
};

const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  bootstrapMaxChars: 20_000,
  bootstrapTotalMaxChars: 60_000,
  contextInjection: "always",
};

function resolveProfileSettings(config?: Record<string, unknown>): ProfileSettings {
  const agents = config?.agents as Record<string, unknown> | undefined;
  const defaults = agents?.defaults as Record<string, unknown> | undefined;
  const bootstrapMaxChars =
    typeof defaults?.bootstrapMaxChars === "number" && Number.isFinite(defaults.bootstrapMaxChars)
      ? Math.floor(defaults.bootstrapMaxChars)
      : DEFAULT_PROFILE_SETTINGS.bootstrapMaxChars;
  const bootstrapTotalMaxChars =
    typeof defaults?.bootstrapTotalMaxChars === "number" &&
    Number.isFinite(defaults.bootstrapTotalMaxChars)
      ? Math.floor(defaults.bootstrapTotalMaxChars)
      : DEFAULT_PROFILE_SETTINGS.bootstrapTotalMaxChars;
  const contextInjection =
    defaults?.contextInjection === "continuation-skip" ? "continuation-skip" : "always";
  return { bootstrapMaxChars, bootstrapTotalMaxChars, contextInjection };
}

function profileSettingsEqual(a: ProfileSettings, b: ProfileSettings): boolean {
  return (
    a.bootstrapMaxChars === b.bootstrapMaxChars &&
    a.bootstrapTotalMaxChars === b.bootstrapTotalMaxChars &&
    a.contextInjection === b.contextInjection
  );
}

function formatCharBudget(value: number): string {
  return `${value.toLocaleString()} chars`;
}

function formatContextInjectionLabel(mode: ProfileSettings["contextInjection"]): string {
  return mode === "always" ? "Every turn" : "Skip safe follow-ups";
}

function describeContextInjection(mode: ProfileSettings["contextInjection"]): string {
  return mode === "always"
    ? "Reinject workspace bootstrap context on every turn."
    : "Skip bootstrap reinjection after a completed safe follow-up.";
}

function renderProfileStat(params: {
  label: string;
  value: string;
  previousValue: string;
  note: string;
}) {
  const changed = params.value !== params.previousValue;
  return html`
    <div class="qs-profile-stat ${changed ? "qs-profile-stat--changed" : ""}">
      <div class="qs-profile-stat__header">
        <span class="qs-profile-stat__label">${params.label}</span>
        <span class="qs-profile-stat__value">${params.value}</span>
      </div>
      <div class="qs-profile-stat__sub">
        ${changed ? `Was ${params.previousValue}` : "Matches current default"}
      </div>
      <div class="qs-profile-stat__note muted">${params.note}</div>
    </div>
  `;
}

// ── Card renderers ──

function renderCardHeader(icon: TemplateResult, title: string, action?: TemplateResult) {
  return html`
    <div class="qs-card__header">
      <div class="qs-card__header-left">
        <span class="qs-card__icon">${icon}</span>
        <h3 class="qs-card__title">${title}</h3>
      </div>
      ${action ? action : nothing}
    </div>
  `;
}

// Thinking only takes effect on reasoning models; other models clamp every
// level to "off" server-side. Show the control as unavailable rather than
// letting it look like it applied.
function renderThinkingRow(props: QuickSettingsProps) {
  const supported = props.thinkingSupported !== false;
  return html`
    <div class="qs-row">
      <span class="qs-row__labelwrap">
        <span class="qs-row__label">Thinking</span>
        <span class="qs-row__hint">for the chat you have open</span>
      </span>
      ${supported
        ? html`
            <div class="qs-segmented">
              ${THINKING_LEVELS.map(
                (level) => html`
                  <button
                    class="qs-segmented__btn ${level === props.thinkingLevel
                      ? "qs-segmented__btn--active"
                      : ""}"
                    @click=${() => props.onThinkingChange?.(level)}
                  >
                    ${level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                `,
              )}
            </div>
          `
        : html`<span class="qs-row__value muted">Not available for this model</span>`}
    </div>
  `;
}

// Fast mode maps to Anthropic's service_tier and is ignored by every other
// provider, so the switch is hidden unless it can actually do something.
function renderFastModeRow(props: QuickSettingsProps) {
  if (props.fastModeSupported === false) {
    return nothing;
  }
  return html`
    <div class="qs-row">
      <span class="qs-row__labelwrap">
        <span class="qs-row__label">Fast mode</span>
        <span class="qs-row__hint">for the chat you have open</span>
      </span>
      <label class="qs-toggle">
        <input type="checkbox" .checked=${props.fastMode} @change=${props.onFastModeToggle} />
        <span class="qs-toggle__track"></span>
        <span class="qs-toggle__hint muted"
          >${props.fastMode ? "On — prefers faster capacity" : "Off — standard capacity"}</span
        >
      </label>
    </div>
  `;
}

function renderModelCard(props: QuickSettingsProps) {
  return html`
    <div class="qs-card qs-card--model">
      ${renderCardHeader(icons.brain, "Model & Thinking")}
      <div class="qs-card__body">
        <div class="qs-row">
          <span class="qs-row__label">Model</span>
          <span class="qs-row__value qs-row__value--split">
            <code title=${props.currentModel || "default"}>${props.currentModel || "default"}</code>
            <button class="btn btn--sm" @click=${props.onModelChange}>Manage</button>
          </span>
        </div>
        ${renderThinkingRow(props)} ${renderFastModeRow(props)}
      </div>
    </div>
  `;
}

function renderChannelsCard(props: QuickSettingsProps) {
  const connectedCount = props.channels.filter((c) => c.connected).length;
  const badge =
    connectedCount > 0
      ? html`<span class="qs-badge qs-badge--ok">${connectedCount} connected</span>`
      : undefined;

  return html`
    <div class="qs-card qs-card--channels">
      ${renderCardHeader(icons.send, "Channels", badge)}
      <div class="qs-card__body">
        ${props.channels.length === 0
          ? html`<div class="qs-empty muted">No channels configured</div>`
          : props.channels.map((ch) => {
              const disconnecting = props.channelDisconnectBusy === ch.id;
              const connecting = props.channelConnectBusy === ch.id;
              return html`
                <div class="qs-row">
                  <span class="qs-row__label">
                    ${renderChannelBrandIcon(ch.id, { compact: true })}
                    <span class="qs-status-dot ${ch.connected ? "qs-status-dot--ok" : ""}"></span>
                    ${ch.label}
                    ${ch.requests
                      ? html`<button
                          class="qs-badge qs-badge--warn qs-badge--action"
                          title="Pending access requests"
                          @click=${() => props.onChannelConfigure?.(ch.id)}
                        >
                          ${ch.requests} request${ch.requests === 1 ? "" : "s"}
                        </button>`
                      : nothing}
                  </span>
                  <span class="qs-row__value qs-channel-actions">
                    ${ch.connected
                      ? html`
                          <span class="muted">${ch.detail ?? "Connected"}</span>
                          <button
                            class="qs-link-btn"
                            @click=${() => props.onChannelConfigure?.(ch.id)}
                          >
                            Manage
                          </button>
                          <button
                            class="qs-link-btn qs-link-btn--danger"
                            ?disabled=${disconnecting || Boolean(props.channelDisconnectBusy)}
                            @click=${() => props.onChannelDisconnect?.(ch.id)}
                          >
                            ${disconnecting ? "Disconnecting…" : "Disconnect"}
                          </button>
                        `
                      : html`<button
                          class="qs-link-btn"
                          ?disabled=${connecting || Boolean(props.channelConnectBusy)}
                          @click=${() => props.onChannelConnect?.(ch.id)}
                        >
                          ${connecting ? "Connecting…" : "Connect →"}
                        </button>`}
                  </span>
                </div>
              `;
            })}
        <div class="qs-row qs-add-channel">
          <button class="qs-link-btn" @click=${() => props.onAddChannel?.()}>+ Add channel</button>
        </div>
      </div>
    </div>
  `;
}

function renderAutomationsCard(props: QuickSettingsProps) {
  const { cronJobCount, skillCount, mcpServerCount } = props.automation;

  return html`
    <div class="qs-card qs-card--automations">
      ${renderCardHeader(icons.zap, "Automations")}
      <div class="qs-card__body">
        <div class="qs-row">
          <span class="qs-row__label">
            ${cronJobCount} scheduled task${cronJobCount !== 1 ? "s" : ""}
          </span>
          <button class="qs-link-btn" @click=${props.onManageCron}>Manage →</button>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">
            ${skillCount} skill${skillCount !== 1 ? "s" : ""} installed
          </span>
          <button class="qs-link-btn" @click=${props.onBrowseSkills}>Browse →</button>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">
            ${mcpServerCount} MCP server${mcpServerCount !== 1 ? "s" : ""}
          </span>
          <button class="qs-link-btn" @click=${props.onConfigureMcp}>Configure →</button>
        </div>
      </div>
    </div>
  `;
}

function renderSecurityCard(props: QuickSettingsProps) {
  const { gatewayAuth, execPolicy, deviceAuth, browserEnabled, toolProfile } = props.security;
  const normalizedToolProfile = toolProfile.trim() || "full";
  const toolProfiles = TOOL_PROFILES.includes(normalizedToolProfile)
    ? TOOL_PROFILES
    : [...TOOL_PROFILES, normalizedToolProfile];

  return html`
    <div class="qs-card qs-card--security">
      ${renderCardHeader(
        icons.eye,
        "Security",
        html`<button class="qs-link-btn" @click=${props.onSecurityConfigure}>Configure →</button>`,
      )}
      <div class="qs-card__body">
        <div class="qs-row">
          <span class="qs-row__label">Gateway auth</span>
          <span class="qs-row__value">
            <span class="qs-badge ${gatewayAuth !== "none" ? "qs-badge--ok" : "qs-badge--warn"}"
              >${gatewayAuth}</span
            >
          </span>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">Exec policy</span>
          <span class="qs-row__value"><span class="qs-badge">${execPolicy}</span></span>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">${t("quickSettings.security.browserEnabled")}</span>
          <label class="qs-toggle">
            <input
              type="checkbox"
              .checked=${browserEnabled}
              @change=${(event: Event) =>
                props.onBrowserEnabledToggle?.((event.currentTarget as HTMLInputElement).checked)}
            />
            <span class="qs-toggle__track"></span>
            <span class="qs-toggle__hint muted">${browserEnabled ? "Enabled" : "Disabled"}</span>
          </label>
        </div>
        <div class="qs-row qs-row--tool-profile">
          <span class="qs-row__label">${t("quickSettings.security.toolProfile")}</span>
          <div class="qs-segmented">
            ${toolProfiles.map(
              (profile) => html`
                <button
                  class="qs-segmented__btn qs-segmented__btn--compact ${profile ===
                  normalizedToolProfile
                    ? "qs-segmented__btn--active"
                    : ""}"
                  @click=${() => props.onToolProfileChange?.(profile)}
                >
                  ${profile}
                </button>
              `,
            )}
          </div>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">Device auth</span>
          <span class="qs-row__value">
            <span class="qs-badge ${deviceAuth ? "qs-badge--ok" : "qs-badge--warn"}"
              >${deviceAuth ? "Enabled" : "Disabled"}</span
            >
          </span>
        </div>
      </div>
    </div>
  `;
}

function renderAppearanceCard(props: QuickSettingsProps) {
  return html`
    <div class="qs-card qs-card--appearance">
      ${renderCardHeader(icons.spark, "Appearance")}
      <div class="qs-card__body">
        <div class="qs-row">
          <span class="qs-row__label">Mode</span>
          <div class="qs-segmented">
            ${(["light", "dark", "system"] as ThemeMode[]).map(
              (mode) => html`
                <button
                  class="qs-segmented__btn ${mode === props.themeMode
                    ? "qs-segmented__btn--active"
                    : ""}"
                  @click=${(e: Event) => {
                    if (mode !== props.themeMode) {
                      props.setThemeMode(mode, {
                        element: (e.currentTarget as HTMLElement) ?? undefined,
                      });
                    }
                  }}
                >
                  ${mode.charAt(0).toUpperCase() + mode.slice(1)}
                </button>
              `,
            )}
          </div>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">Roundness</span>
          <div class="qs-segmented">
            ${BORDER_RADIUS_STOPS.map(
              (stop) => html`
                <button
                  class="qs-segmented__btn qs-segmented__btn--compact ${stop.value ===
                  props.borderRadius
                    ? "qs-segmented__btn--active"
                    : ""}"
                  @click=${() => props.setBorderRadius(stop.value)}
                >
                  ${stop.label}
                </button>
              `,
            )}
          </div>
        </div>
        <div class="qs-row">
          <span class="qs-row__label">Text size</span>
          <div class="qs-segmented">
            ${TEXT_SCALE_OPTIONS.map(
              (stop) => html`
                <button
                  class="qs-segmented__btn qs-segmented__btn--compact ${stop.value ===
                  props.textScale
                    ? "qs-segmented__btn--active"
                    : ""}"
                  title=${`${stop.value}%`}
                  @click=${() => props.setTextScale(stop.value)}
                >
                  ${stop.label}
                </button>
              `,
            )}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPersonalCard(props: QuickSettingsProps) {
  const identity = normalizeLocalUserIdentity({
    name: null,
    avatar: props.userAvatar ?? null,
  });
  const avatarText = resolveLocalUserAvatarText(identity) ?? "";
  const assistantName = normalizeOptionalString(props.assistantName) ?? "Assistant";
  const assistantAvatarUrl = resolveAssistantPreviewAvatarUrl(props);
  const assistantAvatarRendered = Boolean(
    assistantAvatarUrl ||
    resolveAssistantTextAvatar(props.assistantAvatarOverride ?? props.assistantAvatar),
  );
  const assistantAvatarOverride = normalizeOptionalString(props.assistantAvatarOverride);
  const assistantAvatarSource = formatAssistantAvatarSource(
    assistantAvatarOverride ?? props.assistantAvatarSource,
  );
  const assistantAvatarIssue = formatAssistantAvatarIssue(
    props.assistantAvatarStatus ?? null,
    props.assistantAvatarReason,
    assistantAvatarRendered,
    Boolean(assistantAvatarOverride),
  );
  const assistantAvatarSourceLabel = assistantAvatarOverride ? "UI override" : "IDENTITY.md";
  const canOverrideAssistantAvatar = Boolean(props.onAssistantAvatarOverrideChange);
  const assistantAvatarSubtitle = assistantAvatarOverride
    ? "Override from settings"
    : assistantAvatarIssue
      ? "Fallback avatar"
      : assistantAvatarRendered
        ? "From IDENTITY.md"
        : "Fallback logo";
  return html`
    <div class="qs-card qs-card--personal">
      ${renderCardHeader(icons.image, "Personal")}
      <div class="qs-card__body">
        <div class="qs-identity-grid">
          <section class="qs-identity-card" aria-label="Your local chat identity">
            ${renderLocalUserAvatarPreview(props.userAvatar)}
            <div class="qs-identity-card__copy">
              <div class="qs-identity-card__eyebrow">User</div>
              <div class="qs-identity-card__title">${LOCAL_USER_LABEL}</div>
              <div class="qs-identity-card__sub">Avatar is browser-local</div>
              <div class="qs-identity-card__repair">
                <label class="qs-field">
                  <span class="qs-row__label">Avatar text / emoji</span>
                  <input
                    class="qs-field__input"
                    type="text"
                    maxlength="16"
                    .value=${avatarText}
                    placeholder="JD or 🌼"
                    @input=${(e: Event) => {
                      const value = (e.target as HTMLInputElement).value;
                      props.onUserAvatarChange?.(value.trim() ? value : null);
                    }}
                  />
                </label>
                <div class="qs-identity-card__actions">
                  <label class="btn btn--sm">
                    Choose image
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      @change=${(e: Event) => handleLocalUserAvatarFileSelect(e, props)}
                    />
                  </label>
                  <button
                    type="button"
                    class="btn btn--sm btn--ghost"
                    ?disabled=${!identity.avatar}
                    @click=${() => {
                      props.onUserAvatarChange?.(null);
                    }}
                  >
                    Clear avatar
                  </button>
                </div>
                <div class="muted">Stored in this browser only.</div>
              </div>
            </div>
          </section>
          <section
            class="qs-identity-card qs-identity-card--assistant"
            aria-label="Assistant identity"
          >
            ${renderAssistantAvatarPreview(props)}
            <div class="qs-identity-card__copy">
              <div class="qs-identity-card__eyebrow">Assistant</div>
              <div class="qs-identity-card__title">${assistantName}</div>
              <div class="qs-identity-card__sub">${assistantAvatarSubtitle}</div>
              ${assistantAvatarSource
                ? html`
                    <div
                      class="qs-identity-card__source"
                      title=${props.assistantAvatarSource ?? ""}
                    >
                      <span>${assistantAvatarSourceLabel}</span>
                      <code>${assistantAvatarSource}</code>
                    </div>
                  `
                : nothing}
              ${assistantAvatarIssue
                ? html`<div class="qs-identity-card__issue">${assistantAvatarIssue}</div>`
                : nothing}
              ${canOverrideAssistantAvatar
                ? html`
                    <div class="qs-identity-card__repair">
                      <div class="qs-identity-card__actions">
                        <label class="btn btn--sm">
                          ${props.assistantAvatarUploadBusy
                            ? "Saving..."
                            : assistantAvatarOverride
                              ? "Replace image"
                              : "Choose image"}
                          <input
                            type="file"
                            accept="image/*"
                            hidden
                            ?disabled=${props.assistantAvatarUploadBusy === true}
                            @change=${(e: Event) => handleAssistantAvatarFileSelect(e, props)}
                          />
                        </label>
                        ${assistantAvatarOverride
                          ? html`
                              <button
                                type="button"
                                class="btn btn--sm btn--ghost"
                                ?disabled=${props.assistantAvatarUploadBusy === true}
                                @click=${() => {
                                  void props.onAssistantAvatarClearOverride?.();
                                }}
                              >
                                Clear override
                              </button>
                            `
                          : nothing}
                      </div>
                      <div class="muted">
                        Stores a Control UI override. Clear it to return to IDENTITY.md.
                      </div>
                    </div>
                  `
                : nothing}
              ${props.assistantAvatarUploadError
                ? html`<div class="qs-identity-card__error">
                    ${props.assistantAvatarUploadError}
                  </div>`
                : nothing}
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}

function renderPresetsCard(props: QuickSettingsProps) {
  const draftConfig = props.configObject ?? props.savedConfigObject ?? {};
  const savedConfig = props.savedConfigObject ?? {};
  const selectedPresetId = detectActivePreset(draftConfig);
  const savedPresetId = detectActivePreset(savedConfig);
  const selectedPreset = selectedPresetId ? getPresetById(selectedPresetId) : undefined;
  const savedPreset = savedPresetId ? getPresetById(savedPresetId) : undefined;
  const draftSettings = resolveProfileSettings(draftConfig);
  const savedSettings = resolveProfileSettings(savedConfig);
  const hasPendingProfileChange = !profileSettingsEqual(draftSettings, savedSettings);
  const hasPendingConfigChange = props.configDirty === true;
  const canCommit =
    props.connected &&
    props.configReady === true &&
    props.configSaving !== true &&
    props.configApplying !== true;
  const stateBanner = hasPendingProfileChange
    ? html`
        <div class="qs-profile-state qs-profile-state--pending" aria-live="polite">
          <span class="qs-status-dot"></span>
          <div class="qs-profile-state__text">
            <span class="qs-profile-state__title"
              >${selectedPreset?.label ?? "Custom"} is selected but not saved yet.</span
            >
            <span class="qs-profile-state__copy"
              >Save Profile writes it as the default. Apply Now writes it and reloads the current
              session.</span
            >
          </div>
        </div>
      `
    : savedPreset
      ? html`
          <div class="qs-profile-state qs-profile-state--ok" aria-live="polite">
            <span class="qs-status-dot qs-status-dot--ok"></span>
            <div class="qs-profile-state__text">
              <span class="qs-profile-state__title"
                >${savedPreset.label} is your current default.</span
              >
              <span class="qs-profile-state__copy"
                >Profiles only change bootstrap size and follow-up reinjection behavior.</span
              >
            </div>
          </div>
        `
      : html`
          <div class="qs-profile-state" aria-live="polite">
            <span class="qs-status-dot"></span>
            <div class="qs-profile-state__text">
              <span class="qs-profile-state__title">Custom bootstrap settings are active.</span>
              <span class="qs-profile-state__copy"
                >Choose a built-in profile to replace the current custom values.</span
              >
            </div>
          </div>
        `;
  const panelTitle = selectedPreset?.label ?? "Custom Configuration";
  const panelDescription =
    selectedPreset?.detail ?? "This config does not currently match one of the built-in profiles.";
  const panelImpact =
    selectedPreset?.impact ??
    "Pick a profile to stage a focused change to bootstrap size and follow-up behavior.";
  const commitCopy = hasPendingProfileChange
    ? "Save Profile writes this as the default. Apply Now writes it and reloads the current session."
    : "Other staged config edits are pending. Saving here will commit all staged config changes.";

  return html`
    <div class="qs-card qs-card--span-all">
      ${renderCardHeader(
        icons.zap,
        "Context Profile",
        hasPendingProfileChange
          ? html`<span class="qs-badge qs-badge--warn">Pending</span>`
          : savedPreset
            ? html`<span class="qs-badge qs-badge--ok">Saved</span>`
            : html`<span class="qs-badge">Custom</span>`,
      )}
      <div class="qs-card__body qs-profiles">
        <div class="qs-profiles__copy">
          <div class="qs-profiles__eyebrow">Bootstrap Context</div>
          <p class="qs-profiles__intro">
            Choose how much workspace context Daisy injects into each run. These profiles do not
            change your model, tools, channels, or theme.
          </p>
          ${stateBanner}
          <div class="qs-presets-grid">
            ${CONFIG_PRESETS.map((preset) => {
              const presetDefaults = ((preset.patch.agents as Record<string, unknown> | undefined)
                ?.defaults ?? {}) as Record<string, unknown>;
              const presetContext =
                presetDefaults.contextInjection === "continuation-skip"
                  ? "continuation-skip"
                  : "always";
              return html`
                <button
                  type="button"
                  class="qs-preset ${preset.id === selectedPresetId ? "qs-preset--active" : ""}"
                  aria-pressed=${preset.id === selectedPresetId}
                  @click=${() => props.onSelectPreset?.(preset.id)}
                >
                  <div class="qs-preset__head">
                    <div class="qs-preset__identity">
                      <span class="qs-preset__icon" aria-hidden="true"
                        >${PRESET_ICONS[preset.id] ?? preset.icon}</span
                      >
                      <div class="qs-preset__identity-copy">
                        <span class="qs-preset__label">${preset.label}</span>
                        <span class="qs-preset__desc muted">${preset.description}</span>
                      </div>
                    </div>
                    <div class="qs-preset__badges">
                      ${preset.id === savedPresetId
                        ? html`<span class="qs-badge qs-badge--ok">Current</span>`
                        : nothing}
                      ${hasPendingProfileChange && preset.id === selectedPresetId
                        ? html`<span class="qs-badge qs-badge--warn">Selected</span>`
                        : nothing}
                    </div>
                  </div>
                  <div class="qs-preset__meta">
                    <span
                      >${formatCharBudget(Number(presetDefaults.bootstrapMaxChars ?? 0))} per
                      file</span
                    >
                    <span
                      >${formatCharBudget(Number(presetDefaults.bootstrapTotalMaxChars ?? 0))}
                      total</span
                    >
                    <span>${formatContextInjectionLabel(presetContext)}</span>
                  </div>
                </button>
              `;
            })}
          </div>
        </div>

        <div class="qs-profile-panel">
          <div class="qs-profile-panel__eyebrow">
            ${selectedPreset ? "Selected Profile" : "Current Values"}
          </div>
          <h4 class="qs-profile-panel__title">${panelTitle}</h4>
          <p class="qs-profile-panel__copy">${panelDescription}</p>
          <div class="qs-profile-panel__impact">${panelImpact}</div>

          <div class="qs-profile-panel__stats">
            ${renderProfileStat({
              label: "Bootstrap Per File",
              value: formatCharBudget(draftSettings.bootstrapMaxChars),
              previousValue: formatCharBudget(savedSettings.bootstrapMaxChars),
              note: "Maximum context injected from any single bootstrap file.",
            })}
            ${renderProfileStat({
              label: "Bootstrap Total",
              value: formatCharBudget(draftSettings.bootstrapTotalMaxChars),
              previousValue: formatCharBudget(savedSettings.bootstrapTotalMaxChars),
              note: "Total combined context allowed across all bootstrap files.",
            })}
            ${renderProfileStat({
              label: "Follow-up Turns",
              value: formatContextInjectionLabel(draftSettings.contextInjection),
              previousValue: formatContextInjectionLabel(savedSettings.contextInjection),
              note: describeContextInjection(draftSettings.contextInjection),
            })}
          </div>

          ${hasPendingConfigChange
            ? html`
                <div class="qs-profile-panel__actions">
                  <div class="qs-profile-panel__actions-copy muted">${commitCopy}</div>
                  <div class="qs-profile-panel__actions-row">
                    <button
                      class="btn btn--sm"
                      ?disabled=${props.configSaving === true || props.configApplying === true}
                      @click=${props.onResetConfig}
                    >
                      Discard
                    </button>
                    <button
                      class="btn btn--sm primary"
                      ?disabled=${!canCommit}
                      @click=${props.onSaveConfig}
                    >
                      ${props.configSaving === true
                        ? "Saving…"
                        : hasPendingProfileChange
                          ? "Save Profile"
                          : "Save Changes"}
                    </button>
                    <button
                      class="btn btn--sm"
                      ?disabled=${!canCommit}
                      @click=${props.onApplyConfig}
                    >
                      ${props.configApplying === true ? "Applying…" : "Apply Now"}
                    </button>
                  </div>
                </div>
              `
            : html`
                <div class="qs-profile-panel__footer muted" aria-live="polite">
                  ${savedPreset
                    ? "Saved and ready. Choose another profile to stage a change."
                    : "Current values are custom. Choose a profile to stage a change."}
                </div>
              `}
        </div>
      </div>
    </div>
  `;
}

/** What a factory reset erases; shown verbatim in the confirm card. */
export const FACTORY_RESET_ERASES: readonly string[] = [
  "Every chat and its history",
  "Daisy's memory, notes, tasks and reminders",
  "API keys, model choices and your custom servers",
  "Connected channels — WhatsApp, Telegram, Discord… will need linking again",
  "Skill settings and anything Daisy saved to her workspace",
];

function renderResetCard(props: QuickSettingsProps) {
  const open = props.resetOpen === true;
  const acknowledged = props.resetAcknowledged === true;
  const busy = props.factoryResetBusy === true;
  return html`
    <div class="qs-card qs-card--reset" data-qs-reset>
      ${renderCardHeader(icons.refresh, "Start over")}
      <div class="qs-card__body">
        <div class="qs-reset__intro">
          <p>
            Run the guided setup again to change your AI brain, skills or channels — nothing is
            deleted. Or reset Daisy completely to erase all data and begin like a fresh install.
          </p>
          <div class="qs-reset__actions">
            <button class="btn btn--sm" ?disabled=${busy} @click=${() => props.onRunSetupAgain?.()}>
              Run setup again
            </button>
            <button
              class="btn btn--sm"
              data-qs-reset-toggle
              aria-expanded=${open ? "true" : "false"}
              ?disabled=${busy}
              @click=${() => props.onResetOpenChange?.(!open)}
            >
              ${open ? "Keep my data" : "Reset Daisy…"}
            </button>
          </div>
        </div>
        ${open
          ? html`
              <div class="qs-reset__panel" role="region" aria-label="Reset Daisy">
                <div class="qs-reset__panel-title">
                  ${icons.alertTriangle} This erases everything on this computer
                </div>
                <ul class="qs-reset__list">
                  ${FACTORY_RESET_ERASES.map((line) => html`<li>${line}</li>`)}
                </ul>
                <div class="qs-reset__keep">
                  Kept: the link between this app and Daisy's engine, so Daisy reopens by itself and
                  the setup guide starts right away. Nothing is sent anywhere — this only touches
                  this computer.
                </div>
                <label class="qs-reset__ack">
                  <input
                    type="checkbox"
                    data-qs-reset-ack
                    .checked=${acknowledged}
                    ?disabled=${busy}
                    @change=${(event: Event) =>
                      props.onResetAcknowledgedChange?.(
                        (event.currentTarget as HTMLInputElement).checked,
                      )}
                  />
                  <span>I understand this cannot be undone.</span>
                </label>
                <div class="qs-reset__confirm-row">
                  <button
                    class="btn danger"
                    data-qs-reset-confirm
                    ?disabled=${!acknowledged || busy}
                    @click=${() => props.onFactoryReset?.()}
                  >
                    ${busy ? "Resetting…" : "Erase everything and start over"}
                  </button>
                  <button
                    class="btn btn--sm"
                    ?disabled=${busy}
                    @click=${() => props.onResetOpenChange?.(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            `
          : nothing}
      </div>
    </div>
  `;
}

function formatSpend(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "—";
  }
  return `$${value.toFixed(2)}`;
}

/**
 * What Daisy has cost this month, and the ceiling on it.
 *
 * The money goes straight to the user's own AI provider, so this is not a bill
 * from us: it is the only price they pay, and it used to be invisible until a
 * statement arrived weeks later.
 */
function renderSpendingCard(props: QuickSettingsProps) {
  if (!props.onSpendingLimitChange) {
    return nothing;
  }
  const limit = props.spendingLimitUsd ?? null;
  const spent = props.spendingThisMonthUsd ?? null;
  const overLimit = props.spendingExceeded === true;
  const nearLimit =
    !overLimit && limit != null && typeof spent === "number" && spent >= limit * 0.8;
  return html`
    <div class="qs-card qs-card--spending" data-qs-spending>
      ${renderCardHeader(icons.activity, "Spending")}
      <div class="qs-card__body qs-spending">
        <div class="qs-spending__figure">
          <span class="qs-spending__amount" data-qs-spent>${formatSpend(spent)}</span>
          <span class="qs-spending__caption">this month, paid to your AI provider</span>
        </div>
        ${overLimit
          ? html`<p class="qs-spending__notice qs-spending__notice--stop">
              Daisy has stopped making paid requests until you raise the limit or next month starts.
            </p>`
          : nearLimit
            ? html`<p class="qs-spending__notice">
                Close to your limit. Follow-up suggestions are paused to save what is left.
              </p>`
            : nothing}
        <label class="qs-spending__limit">
          <span>Stop after</span>
          <span class="qs-spending__input">
            <span aria-hidden="true">$</span>
            <input
              type="number"
              min="0"
              step="1"
              inputmode="decimal"
              data-qs-spending-limit
              .value=${limit == null ? "" : String(limit)}
              placeholder="no limit"
              aria-label="Monthly spending limit in dollars"
              @change=${(event: Event) => {
                const raw = (event.target as HTMLInputElement).value.trim();
                const parsed = raw === "" ? null : Number(raw);
                props.onSpendingLimitChange?.(
                  parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : null,
                );
              }}
            />
          </span>
          <span>a month</span>
        </label>
        <p class="qs-spending__hint">
          Leave it empty for no limit. Daisy warns you before it stops, and the count starts again
          each month.
        </p>
      </div>
    </div>
  `;
}

function renderDiagnosticsCard(props: QuickSettingsProps) {
  if (!props.onCreateSupportBundle) {
    return nothing;
  }
  return html`
    <div class="qs-card qs-card--diagnostics" data-qs-diagnostics>
      ${renderCardHeader(icons.helpCircle, "Something wrong?")}
      <div class="qs-card__body">
        <div class="qs-reset__intro">
          <p>
            Daisy can gather its own logs into one file you can send on. Keys and message contents
            are removed first, and nothing leaves this computer until you share it.
          </p>
          <div class="qs-reset__actions">
            <button
              class="btn btn--sm"
              data-qs-support-bundle
              ?disabled=${props.supportBundleBusy === true}
              @click=${() => props.onCreateSupportBundle?.()}
            >
              ${props.supportBundleBusy ? "Collecting…" : "Create support report"}
            </button>
          </div>
        </div>
        ${props.supportBundleResult
          ? html`<div
              class="callout ${props.supportBundleResult.ok ? "" : "danger"}"
              style="margin: 0 16px 16px;"
              data-qs-support-bundle-result
            >
              ${props.supportBundleResult.message}
            </div>`
          : nothing}
      </div>
    </div>
  `;
}

function renderConnectionFooter(props: QuickSettingsProps) {
  return html`
    <div class="qs-footer">
      <div class="qs-footer__row">
        <span class="qs-status-dot ${props.connected ? "qs-status-dot--ok" : ""}"></span>
        <span class="muted">${props.connected ? "Connected" : "Offline"}</span>
        ${props.assistantName ? html`<span class="muted">· ${props.assistantName}</span>` : nothing}
        ${props.version ? html`<span class="muted">· v${props.version}</span>` : nothing}
      </div>
    </div>
  `;
}

// ── Main render ──

export function renderQuickSettings(props: QuickSettingsProps) {
  // Gateway auth, exec policy, tool profiles and bootstrap-context budgets are
  // operator controls. They stay for a developer install and leave the Settings
  // a customer sees, where they only taught people they were in the wrong product.
  const operatorCards = !isConsumerBuild();
  return html`
    <div class="qs-container">
      <div class="qs-header">
        <h2 class="qs-header__title">${icons.settings} Quick Settings</h2>
        <button class="btn btn--sm" @click=${props.onAdvancedSettings}>
          Advanced ${icons.chevronRight}
        </button>
      </div>

      <div class="qs-grid">
        ${renderModelCard(props)} ${renderChannelsCard(props)}
        ${operatorCards ? renderSecurityCard(props) : nothing} ${renderPersonalCard(props)}
        <div class="qs-side-stack">
          ${renderAppearanceCard(props)} ${renderAutomationsCard(props)}
        </div>
        ${props.onConnectAccount
          ? renderConnectionsCard({
              skills: props.connectionSkills,
              drafts: props.connectionDrafts ?? {},
              busyKey: props.connectionBusyKey,
              notice: props.connectionNotice,
              onDraftChange: (env, value) => props.onConnectionDraftChange?.(env, value),
              onConnect: (definition) => props.onConnectAccount?.(definition),
            })
          : nothing}
        ${renderSpendingCard(props)} ${operatorCards ? renderPresetsCard(props) : nothing}
        ${renderDiagnosticsCard(props)} ${renderResetCard(props)}
      </div>

      ${renderConnectionFooter(props)}
    </div>
  `;
}
