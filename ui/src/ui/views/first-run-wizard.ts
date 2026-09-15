// Control UI first-run wizard: a five-screen guided setup shown once, on a
// fresh install, before the dashboard. Screens: Welcome → AI brain (required)
// → Starter skills → Channel picker (skippable) → Done. Built directly on the
// existing save paths (Model Studio mutations, skills.update, channels.status)
// rather than the CLI wizard runtime, which replays terminal-only steps.
import { html, nothing, type TemplateResult } from "lit";
import { getSafeLocalStorage } from "../../local-storage.ts";
import type { AppViewState } from "../app-view-state.ts";
import { loadConfig, updateConfigFormValue } from "../controllers/config.ts";
import {
  listProviderModelCandidates,
  type PickedProviderModel,
} from "../controllers/model-pick.ts";
import {
  CUSTOM_PROVIDER_LABELS,
  invalidateModelCatalog,
  loadModels,
  probeCustomProvider,
  saveCustomProvider,
  saveProviderApiKey,
  setDefaultModel,
  verifyProviderModelCandidates,
} from "../controllers/models.ts";
import { loadSkills, updateSkillEnabled } from "../controllers/skills.ts";
import { showToast } from "../toast.ts";
import type { SkillStatusEntry } from "../types.ts";
import { renderChannelSetup } from "./channels.setup.ts";
import type { ChannelsProps } from "./channels.types.ts";
import {
  WIZARD_CHANNEL_LOGOS,
  WIZARD_PROVIDER_LOGOS,
  WIZARD_SKILL_LOGOS,
} from "./first-run-logos.ts";
import { PROVIDER_PRESETS, type ProviderPreset } from "./model-studio.ts";

/** Per-browser completion marker; the bundled app is one browser profile. */
const FIRST_RUN_DONE_KEY = "daisyclaw.control.firstRunDone.v1";

/**
 * Channels offered on the picker screen. Static so a fresh install shows the
 * full menu (channels.status only reflects channels already configured).
 * Every key has a guided setup on the Channels page.
 */
const WIZARD_CHANNELS: ReadonlyArray<{ key: string; label: string; desc: string }> = [
  { key: "whatsapp", label: "WhatsApp", desc: "Scan a QR code — 2 minutes" },
  { key: "telegram", label: "Telegram", desc: "Quick bot setup" },
  { key: "discord", label: "Discord", desc: "Add Daisy to your server" },
  { key: "slack", label: "Slack", desc: "Install to your workspace" },
  { key: "signal", label: "Signal", desc: "Link as a device" },
  { key: "googlechat", label: "Google Chat", desc: "Connect a Chat app" },
];

/**
 * Skills offered on the starter screen, with consumer-friendly names and
 * one-line descriptions (the SKILL.md descriptions are developer-toned).
 * Keys must match the starter tiers in src/skills/default-skill-pack.ts.
 */
type WizardSkillMeta = { key: string; title: string; desc: string; account?: boolean };

const WIZARD_SKILLS: readonly WizardSkillMeta[] = [
  { key: "weather", title: "Weather", desc: "Forecasts for any place, any day" },
  { key: "reminders", title: "Reminders", desc: "Nudges you at the right time" },
  { key: "quick-notes", title: "Quick Notes", desc: "Jot things down by just saying them" },
  { key: "taskflow", title: "Tasks", desc: "Simple to-do lists, managed in chat" },
  { key: "daily-briefing", title: "Daily Briefing", desc: "A morning summary made for you" },
  { key: "diagram-maker", title: "Diagrams", desc: "Turn ideas into clean flowcharts" },
  { key: "meme-maker", title: "Memes", desc: "Fresh memes on demand" },
  { key: "canvas", title: "Canvas", desc: "Visual boards Daisy can draw on" },
  { key: "skill-installer", title: "Skill Finder", desc: "Ask Daisy to add new abilities" },
  { key: "gog", title: "Google", desc: "Gmail, Calendar, and Drive", account: true },
  { key: "spotify-player", title: "Spotify", desc: "Control your music", account: true },
  { key: "notion", title: "Notion", desc: "Read and update your pages", account: true },
  { key: "trello", title: "Trello", desc: "Manage your boards and cards", account: true },
];

// Skills whose enable/disable call failed; their switch falls back to the state
// the gateway reports rather than the state the user asked for.
const wizardSkillErrors = new Set<string>();

// Starter skills default ON. This set holds only the ones the user explicitly
// turned OFF inside the wizard, so re-renders keep those choices.
const wizardSkillsOff = new Set<string>();
let wizardSkillsEnabledOnce = false;

// Transient input drafts. Typing must not re-render the app, so these live
// outside Lit state and are read when the user presses Connect.
const draft = {
  apiKey: "",
  baseUrl: "",
  modelId: "",
};

function resetDraft() {
  draft.apiKey = "";
  draft.baseUrl = "";
  draft.modelId = "";
}

export function isFirstRunDismissed(): boolean {
  try {
    return getSafeLocalStorage()?.getItem(FIRST_RUN_DONE_KEY) === "done";
  } catch {
    return true;
  }
}

export function markFirstRunDone(state: AppViewState): void {
  try {
    getSafeLocalStorage()?.setItem(FIRST_RUN_DONE_KEY, "done");
  } catch {
    // Blocked storage just means the wizard could reappear next launch.
  }
  state.firstRunActive = false;
}

/**
 * Decides once per session whether to show the wizard: never after completion,
 * and only when the gateway has no model provider and no default model — i.e.
 * a genuinely fresh install. Any read failure falls open to the dashboard.
 */
/** True when the URL forces the wizard for design review (?firstRun=preview). */
function isFirstRunPreviewForced(): boolean {
  try {
    return new URLSearchParams(window.location.search).get("firstRun") === "preview";
  } catch {
    return false;
  }
}

/**
 * True when the config has neither a model provider nor a default model —
 * Daisy cannot answer chats until the user adds an "AI brain".
 */
export function resolveModelSetupMissing(
  config: Record<string, unknown> | null | undefined,
): boolean {
  const cfg = config ?? {};
  const models = cfg.models as { providers?: Record<string, unknown> } | undefined;
  const hasProvider = Object.keys(models?.providers ?? {}).length > 0;
  const agents = cfg.agents as { defaults?: { model?: unknown } } | undefined;
  const hasDefaultModel = agents?.defaults?.model !== undefined;
  return !hasProvider && !hasDefaultModel;
}

/** Re-reads the config and updates `state.modelSetupMissing`. Safe to call any time. */
export async function refreshModelSetupState(state: AppViewState): Promise<boolean | null> {
  const client = state.client;
  if (!client) {
    return state.modelSetupMissing;
  }
  try {
    const snapshot = (await client.request("config.get", {})) as {
      config?: Record<string, unknown>;
    } | null;
    state.modelSetupMissing = resolveModelSetupMissing(snapshot?.config);
  } catch {
    // Leave the previous answer in place; the chat lock is advisory.
  }
  return state.modelSetupMissing;
}

export async function evaluateFirstRunWizard(state: AppViewState): Promise<void> {
  if (state.firstRunActive !== null) {
    return;
  }
  if (isFirstRunPreviewForced()) {
    // Design-review escape hatch: show the wizard even on a configured
    // install. Saves still write for real; navigate with Back/Skip.
    state.firstRunActive = true;
    void loadSkills(state).catch(() => undefined);
    return;
  }
  const dismissed = isFirstRunDismissed();
  const client = state.client;
  if (!client) {
    if (dismissed) {
      state.firstRunActive = false;
    }
    return;
  }
  try {
    const missing = await refreshModelSetupState(state);
    if (dismissed) {
      // Setup was finished (or skipped) before: stay on the dashboard, where
      // the chat shows an "add an AI brain" notice if the model is missing.
      state.firstRunActive = false;
      return;
    }
    state.firstRunActive = missing === true;
    if (state.firstRunActive) {
      // Prefetch so the skills screen opens populated.
      void loadSkills(state).catch(() => undefined);
    }
  } catch {
    state.firstRunActive = false;
  }
}

/** Settings → "Run setup again": reopens the guided setup without erasing anything. */
export function reopenFirstRunWizard(state: AppViewState): void {
  try {
    getSafeLocalStorage()?.removeItem(FIRST_RUN_DONE_KEY);
  } catch {
    // ignore
  }
  brainSkipped = false;
  resetDraft();
  state.firstRunError = null;
  state.firstRunBusy = false;
  state.firstRunProvider = null;
  state.firstRunChannel = null;
  state.firstRunStep = 0;
  state.firstRunActive = true;
  void loadSkills(state).catch(() => undefined);
}

// True when the user skipped the AI-brain screen in this wizard session; the
// Done screen then points at Settings instead of promising a chat.
let brainSkipped = false;

function skipBrainForNow(state: AppViewState): void {
  brainSkipped = true;
  state.firstRunError = null;
  state.firstRunProvider = null;
  resetDraft();
  state.firstRunStep = 2;
}

function finishToDashboard(state: AppViewState): void {
  markFirstRunDone(state);
  state.setTab("chat");
}

async function connectProvider(state: AppViewState, preset: ProviderPreset): Promise<void> {
  state.firstRunBusy = true;
  state.firstRunError = null;
  state.firstRunTestFailure = null;
  try {
    if (preset.custom) {
      if (!draft.baseUrl.trim() || !draft.modelId.trim()) {
        throw new Error("Enter the server URL and a model name.");
      }
      // Ask the gateway which product answers at that address so the server
      // is saved under its real name (LiteLLM, Ollama, …) with its model list.
      const probe = await probeCustomProvider(state.client, {
        baseUrl: draft.baseUrl,
        apiKey: draft.apiKey.trim() ? draft.apiKey : undefined,
      });
      const providerId = probe.providerId || "custom";
      const label = probe.label || CUSTOM_PROVIDER_LABELS[providerId] || "Custom server";
      const modelId = draft.modelId.trim();
      await saveCustomProvider(state, {
        providerId,
        baseUrl: probe.baseUrl || draft.baseUrl,
        apiKey: draft.apiKey.trim() ? draft.apiKey : undefined,
        modelId,
        extraModelIds: probe.models,
        modelNameSuffix: providerId === "custom" ? undefined : label,
      });
      await setDefaultModel(state, `${providerId}/${modelId}`);
      if (state.client) {
        invalidateModelCatalog(state.client);
      }
      if (!probe.reachable) {
        showToast(
          `Saved. Couldn't reach ${label.toLowerCase() === "custom server" ? "the server" : label} right now — Daisy will connect once it's online (VPN on?).`,
          { tone: "info" },
        );
      } else if (probe.authRejected) {
        showToast(`${label} rejected the API key. Check it in Settings if chats fail.`, {
          tone: "info",
        });
      } else if (probe.models.length > 0 && !probe.models.includes(modelId)) {
        showToast(
          `${label} doesn't list "${modelId}". Saved anyway — double-check the model name.`,
          {
            tone: "info",
          },
        );
      } else {
        showToast(`Connected to ${label}.`, { tone: "success" });
      }
    } else {
      if (!draft.apiKey.trim()) {
        throw new Error("Paste your API key first.");
      }
      await saveProviderApiKey(state, preset.id, draft.apiKey);
      let candidates: PickedProviderModel[] = [];
      if (state.client) {
        invalidateModelCatalog(state.client);
        try {
          candidates = listProviderModelCandidates(await loadModels(state.client), preset.id);
        } catch {
          // Catalog hiccups are fine — the gateway resolves a provider default.
        }
      }
      // Prove the key actually works now, while the user is still on this
      // screen and the fix is one edit away. Chat hides provider errors, so a
      // bad key would otherwise only surface as "LLM request failed." later.
      // Which models an account may call varies, so a model the account cannot
      // use moves on to the next one instead of ending setup.
      const verified = await verifyProviderModelCandidates({
        client: state.client,
        providerId: preset.id,
        candidates,
      });
      if (verified.verdict && !verified.verdict.ok) {
        state.firstRunTestFailure = verified.verdict.message;
        state.firstRunError = verified.verdict.message;
        return;
      }
      if (verified.model) {
        await setDefaultModel(state, verified.model.ref);
        if (verified.attempted.length > 1) {
          showToast(`Connected. Daisy will use ${verified.model.name}.`, { tone: "success" });
        }
      }
      state.firstRunTestFailure = null;
    }
    resetDraft();
    brainSkipped = false;
    state.modelSetupMissing = false;
    state.firstRunProvider = null;
    state.firstRunStep = 2;
  } catch (err) {
    state.firstRunError = err instanceof Error ? err.message : String(err);
  } finally {
    state.firstRunBusy = false;
  }
}

function wizardSkillRows(
  state: AppViewState,
): Array<{ meta: WizardSkillMeta; skill: SkillStatusEntry }> {
  const report = state.skillsReport;
  if (!report?.skills?.length) {
    return [];
  }
  const byKey = new Map(report.skills.map((skill) => [skill.skillKey, skill]));
  return WIZARD_SKILLS.flatMap((meta) => {
    const skill = byKey.get(meta.key);
    return skill ? [{ meta, skill }] : [];
  });
}

function renderStepBar(step: number): TemplateResult {
  return html`
    <div
      class="first-run__steps"
      role="progressbar"
      aria-valuemin="1"
      aria-valuemax="5"
      aria-valuenow=${step + 1}
    >
      ${[0, 1, 2, 3, 4].map(
        (index) =>
          html`<span
            class="first-run__step ${index <= step ? "first-run__step--filled" : ""}"
          ></span>`,
      )}
    </div>
  `;
}

function renderWelcome(state: AppViewState): TemplateResult {
  return html`
    <h1 class="first-run__title">Hi — I'm Daisy</h1>

    <p class="first-run__lead">
      Your personal assistant that lives on this computer. Everything stays local — no accounts, no
      sign-ups. Setup takes about two minutes.
    </p>
    <button
      class="btn primary first-run__cta"
      @click=${() => {
        state.firstRunStep = 1;
      }}
    >
      Get started
    </button>
    <button class="first-run__skip-link" @click=${() => finishToDashboard(state)}>
      I've already set up DaisyClaw — skip
    </button>
  `;
}

function renderBrain(state: AppViewState): TemplateResult {
  const selected = PROVIDER_PRESETS.find((preset) => preset.id === state.firstRunProvider) ?? null;
  return html`
    <h1 class="first-run__title">Add your AI brain</h1>
    <p class="first-run__lead">
      Daisy thinks with an AI model of your choice. Pick a provider and paste your API key — the key
      stays on this computer.
    </p>
    ${selected
      ? html`
          <div class="first-run__provider-form">
            <div class="first-run__provider-head">
              <span class="first-run__provider-name">${selected.label}</span>
              <button
                class="first-run__link"
                @click=${() => {
                  state.firstRunProvider = null;
                  state.firstRunError = null;
                  resetDraft();
                }}
              >
                Change
              </button>
            </div>
            ${selected.custom
              ? html`
                  <label class="first-run__field">
                    <span>Server URL</span>
                    <input
                      type="text"
                      placeholder="http://localhost:11434/v1 (Ollama, LiteLLM…)"
                      @input=${(e: Event) => {
                        draft.baseUrl = (e.target as HTMLInputElement).value;
                      }}
                    />
                  </label>
                  <label class="first-run__field">
                    <span>Model name</span>
                    <input
                      type="text"
                      placeholder="e.g. llama3.1 or claude-sonnet-4-5"
                      @input=${(e: Event) => {
                        draft.modelId = (e.target as HTMLInputElement).value;
                      }}
                    />
                  </label>
                  <label class="first-run__field">
                    <span>API key (optional for local servers)</span>
                    <input
                      type="password"
                      placeholder="sk-…"
                      @input=${(e: Event) => {
                        draft.apiKey = (e.target as HTMLInputElement).value;
                      }}
                    />
                  </label>
                `
              : html`
                  <label class="first-run__field">
                    <span>API key</span>
                    <input
                      type="password"
                      placeholder=${selected.placeholder ?? "Paste your key"}
                      @input=${(e: Event) => {
                        draft.apiKey = (e.target as HTMLInputElement).value;
                      }}
                    />
                  </label>
                  ${selected.keyHint
                    ? html`<div class="first-run__hint">
                        Where to find it: ${selected.keyHint}
                        ${selected.keyUrl
                          ? html` —
                              <a href=${selected.keyUrl} target="_blank" rel="noreferrer"
                                >open page</a
                              >`
                          : nothing}
                      </div>`
                    : nothing}
                `}
            ${state.firstRunError
              ? html`<div class="first-run__error">${state.firstRunError}</div>`
              : nothing}
            ${state.firstRunTestFailure
              ? html`<button
                  class="first-run__link"
                  data-first-run-continue-anyway
                  @click=${() => {
                    // The key is saved either way; a failing test can also mean a
                    // flaky network, so never trap the user on this screen. The
                    // provider exists now, so chat must not stay locked behind
                    // "Daisy needs an AI brain".
                    state.firstRunTestFailure = null;
                    state.firstRunError = null;
                    state.modelSetupMissing = false;
                    resetDraft();
                    state.firstRunProvider = null;
                    state.firstRunStep = 2;
                  }}
                >
                  Continue anyway — I'll fix this later
                </button>`
              : nothing}
            <button
              class="btn primary first-run__cta"
              ?disabled=${state.firstRunBusy}
              @click=${() => void connectProvider(state, selected)}
            >
              ${state.firstRunBusy ? "Checking your key…" : "Connect"}
            </button>
          </div>
        `
      : html`
          <div class="first-run__grid">
            ${PROVIDER_PRESETS.map(
              (preset) => html`
                <button
                  class="first-run__card first-run__card--provider"
                  @click=${() => {
                    state.firstRunProvider = preset.id;
                    state.firstRunError = null;
                    resetDraft();
                  }}
                >
                  <span
                    class="first-run__provider-logo"
                    data-provider=${preset.id}
                    aria-hidden="true"
                    >${WIZARD_PROVIDER_LOGOS[preset.id] ?? nothing}</span
                  >
                  <span class="first-run__provider-text">
                    <span class="first-run__card-title">${preset.label}</span>
                    <span class="first-run__card-desc">${preset.desc}</span>
                  </span>
                </button>
              `,
            )}
          </div>
          <button
            class="first-run__skip-link"
            data-first-run-skip-brain
            @click=${() => skipBrainForNow(state)}
          >
            Skip for now — you can add this later in Settings (chat waits until then)
          </button>
        `}
  `;
}

function renderSkills(state: AppViewState): TemplateResult {
  const rows = wizardSkillRows(state);
  // All starter skills default ON; enable any that are currently off so the
  // shown state matches the config (runs once per wizard session).
  if (rows.length > 0 && !wizardSkillsEnabledOnce) {
    wizardSkillsEnabledOnce = true;
    for (const { skill } of rows) {
      if (skill.disabled && !wizardSkillsOff.has(skill.skillKey)) {
        void updateSkillEnabled(state, skill.skillKey, true).catch(() => undefined);
      }
    }
  }
  return html`
    <h1 class="first-run__title">Pick your skills</h1>
    <p class="first-run__lead">
      Skills are things Daisy can do for you. These are all on to start — switch off any you don't
      want. You can change this anytime.
    </p>
    ${rows.length === 0
      ? html`<div class="first-run__hint">
          Loading skills…
          <button class="first-run__link" @click=${() => void loadSkills(state)}>Retry</button>
        </div>`
      : html`
          <div class="first-run__skills-grid">
            ${rows.map(({ meta, skill }) => {
              // Default ON, but the switch must follow what the gateway really
              // reports: a skill that failed to turn on used to keep showing as
              // on, and the user only found out when Daisy could not do it.
              const failed = wizardSkillErrors.has(meta.key);
              const enabled = failed ? skill.disabled !== true : !wizardSkillsOff.has(meta.key);
              const logo = WIZARD_SKILL_LOGOS[meta.key];
              return html`
                <div class="first-run__skill-card">
                  <span class="first-run__skill-logo" aria-hidden="true">${logo ?? nothing}</span>
                  <span class="first-run__skill-info">
                    <span class="first-run__skill-title">
                      ${meta.title}
                      ${meta.account
                        ? html`<span class="first-run__skill-chip">needs account</span>`
                        : nothing}
                    </span>
                    <span class="first-run__skill-desc">${meta.desc}</span>
                  </span>
                  <label class="first-run__switch">
                    <input
                      type="checkbox"
                      .checked=${enabled}
                      aria-label=${`Enable ${meta.title}`}
                      @change=${(e: Event) => {
                        const on = (e.target as HTMLInputElement).checked;
                        if (on) {
                          wizardSkillsOff.delete(meta.key);
                        } else {
                          wizardSkillsOff.add(meta.key);
                        }
                        wizardSkillErrors.delete(meta.key);
                        void updateSkillEnabled(state, meta.key, on)
                          .then(() => {
                            wizardSkillErrors.delete(meta.key);
                          })
                          .catch(() => {
                            wizardSkillErrors.add(meta.key);
                            showToast(`${meta.title} could not be turned ${on ? "on" : "off"}.`, {
                              tone: "error",
                            });
                          })
                          .finally(() => {
                            void loadSkills(state).catch(() => undefined);
                          });
                      }}
                    />
                    <span class="first-run__switch-track"></span>
                  </label>
                </div>
              `;
            })}
          </div>
        `}
    <button
      class="btn primary first-run__cta"
      @click=${() => {
        state.firstRunStep = 3;
      }}
    >
      Continue
    </button>
  `;
}

/** Connects the selected channel from inside the wizard, then advances. */
async function wizardConnectChannel(state: AppViewState, key: string): Promise<void> {
  state.channelSetupBusy = key;
  state.firstRunError = null;
  try {
    if (state.configFormDirty) {
      await state.handleChannelConfigSave();
    }
    await state.handleChannelEnable(key);
    state.firstRunChannel = null;
    state.firstRunStep = 4;
  } catch (err) {
    state.firstRunError = err instanceof Error ? err.message : String(err);
  } finally {
    state.channelSetupBusy = null;
  }
}

/** Minimal ChannelsProps surface consumed by renderChannelSetup. */
function wizardChannelsProps(state: AppViewState, key: string): ChannelsProps {
  return {
    channelSetupBusy: state.channelSetupBusy,
    configForm: state.configForm,
    configSaving: state.configSaving,
    onConfigPatch: (path: Array<string | number>, value: unknown) =>
      updateConfigFormValue(state, path, value),
    onChannelSetupConnect: () => void wizardConnectChannel(state, key),
    whatsappBusy: state.whatsappBusy,
    whatsappQrDataUrl: state.whatsappLoginQrDataUrl,
    whatsappMessage: state.whatsappLoginMessage,
    whatsappConnected: state.whatsappLoginConnected,
    onWhatsAppConnect: (force: boolean) => void state.handleWhatsAppConnect(force),
  } as unknown as ChannelsProps;
}

function renderChannelSetupStep(state: AppViewState, key: string): TemplateResult {
  const meta = WIZARD_CHANNELS.find((channel) => channel.key === key);
  const whatsappLinked = key === "whatsapp" && state.whatsappLoginConnected;
  return html`
    <h1 class="first-run__title">Connect ${meta?.label ?? key}</h1>
    ${state.configForm || key === "whatsapp"
      ? html`
          <div class="first-run__channel-setup">
            ${renderChannelSetup(key, wizardChannelsProps(state, key))}
          </div>
        `
      : html`<div class="first-run__hint">Preparing…</div>`}
    ${state.firstRunError
      ? html`<div class="first-run__error">${state.firstRunError}</div>`
      : nothing}
    ${whatsappLinked
      ? html`
          <button
            class="btn primary first-run__cta"
            @click=${() => {
              state.firstRunChannel = null;
              state.firstRunStep = 4;
            }}
          >
            Connected — continue
          </button>
        `
      : nothing}
  `;
}

function renderChannels(state: AppViewState): TemplateResult {
  if (state.firstRunChannel) {
    return renderChannelSetupStep(state, state.firstRunChannel);
  }
  return html`
    <h1 class="first-run__title">Chat with Daisy anywhere</h1>
    <p class="first-run__lead">
      Connect a chat app you already use, and Daisy answers you there. Optional — the built-in chat
      on this dashboard always works.
    </p>
    <div class="first-run__grid first-run__grid--three">
      ${WIZARD_CHANNELS.map(
        (channel) => html`
          <button
            class="first-run__card first-run__card--channel"
            @click=${() => {
              state.firstRunChannel = channel.key;
              state.firstRunError = null;
              // Guide fields read and write the config form; make sure it is
              // loaded before the inputs render.
              void loadConfig(state).catch(() => undefined);
            }}
          >
            <span class="first-run__channel-logo" aria-hidden="true"
              >${WIZARD_CHANNEL_LOGOS[channel.key] ?? nothing}</span
            >
            <span class="first-run__channel-text">
              <span class="first-run__card-title">${channel.label}</span>
              <span class="first-run__card-desc">${channel.desc}</span>
            </span>
          </button>
        `,
      )}
    </div>
    <div class="first-run__hint" style="text-align: center;">
      More apps are available anytime under Channels in the dashboard.
    </div>
    <button
      class="btn primary first-run__cta"
      @click=${() => {
        state.firstRunStep = 4;
      }}
    >
      Skip for now — Daisy's built-in chat always works
    </button>
  `;
}

function renderDone(state: AppViewState): TemplateResult {
  return html`
    <div class="first-run__hero" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        width="32"
        height="32"
        fill="none"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M5.8 11.3 2 22l10.7-3.79" stroke="#F59E0B" />
        <path
          d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"
          stroke="#F59E0B"
        />
        <path d="M4 3h.01" stroke="#EC4899" />
        <path d="M22 8h.01" stroke="#10B981" />
        <path d="M15 2h.01" stroke="#3B82F6" />
        <path d="M22 20h.01" stroke="#A855F7" />
        <path
          d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"
          stroke="#EF4444"
        />
        <path
          d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11-.11.7-.72 1.22-1.43 1.22H17"
          stroke="#14B8A6"
        />
        <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7" stroke="#8B5CF6" />
      </svg>
    </div>
    <h1 class="first-run__title">${brainSkipped ? "Almost there" : "You're all set"}</h1>
    <p class="first-run__lead">
      ${brainSkipped
        ? "Daisy is installed. Chat stays paused until you add an AI brain — the dashboard shows you where."
        : "Daisy is ready. Say hi, ask for the weather, or just tell it about your day."}
    </p>
    <button class="btn primary first-run__cta" @click=${() => finishToDashboard(state)}>
      ${brainSkipped ? "Open the dashboard" : "Start chatting"}
    </button>
  `;
}

/** A short, warm "about Daisy" line shown at the foot of each wizard screen. */
const WIZARD_ABOUT_LINES: readonly string[] = [
  "Daisy runs entirely on your computer. Your conversations never leave this device.",
  "Your API key is stored locally and only ever talks to the provider you choose.",
  "Daisy learns new skills over time — you can add more whenever you like.",
  "Wherever you message Daisy, it's the same assistant with the same memory.",
  "Daisy is here to help, day to day — just talk to it like a friend.",
];

/** Full-screen wizard; rendered instead of the dashboard while active. */
export function renderFirstRunWizard(state: AppViewState): TemplateResult {
  const step = state.firstRunStep;
  const preview = isFirstRunPreviewForced();
  const showBack = step > 0 && step < 4;
  const goBack = () => {
    state.firstRunError = null;
    if (state.firstRunChannel) {
      state.firstRunChannel = null;
      return;
    }
    if (state.firstRunProvider) {
      state.firstRunProvider = null;
      resetDraft();
      return;
    }
    state.firstRunStep = step - 1;
  };
  return html`
    <div class="first-run">
      <div class="first-run__inner">
        ${renderStepBar(step)}
        <div class="first-run__panel ${step === 2 ? "first-run__panel--roomy" : ""}">
          ${showBack
            ? html`<button class="first-run__topback" aria-label="Back" @click=${goBack}>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
                  <path
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 18l-6-6 6-6"
                  />
                </svg>
                Back
              </button>`
            : nothing}
          ${step === 0
            ? renderWelcome(state)
            : step === 1
              ? renderBrain(state)
              : step === 2
                ? renderSkills(state)
                : step === 3
                  ? renderChannels(state)
                  : renderDone(state)}
          <div class="first-run__about">${WIZARD_ABOUT_LINES[step] ?? nothing}</div>
          ${preview
            ? html`
                <div class="first-run__preview-bar">
                  Design preview — nothing is saved when you use these:
                  ${step > 0
                    ? html`<button
                        class="first-run__link"
                        @click=${() => {
                          state.firstRunStep = step - 1;
                        }}
                      >
                        ← prev
                      </button>`
                    : nothing}
                  ${step < 4
                    ? html`<button
                        class="first-run__link"
                        @click=${() => {
                          state.firstRunStep = step + 1;
                        }}
                      >
                        next screen →
                      </button>`
                    : html`<button
                        class="first-run__link"
                        @click=${() => {
                          state.firstRunActive = false;
                          state.setTab("chat");
                        }}
                      >
                        exit preview
                      </button>`}
                </div>
              `
            : nothing}
        </div>
      </div>
    </div>
  `;
}
