// Control UI view renders the guided AI-model manager dialog (Model Studio).
import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { modelCatalogRef } from "../controllers/models.ts";
import { CUSTOM_PROVIDER_LABELS } from "../controllers/models.ts";
import { icons } from "../icons.ts";
import type { ModelAuthStatusResult, ModelCatalogEntry } from "../types.ts";
import { renderModelBrandIcon, renderProviderBrandIcon } from "./model-provider.icons.ts";

export type ModelStudioProps = {
  open: boolean;
  loading: boolean;
  catalog: ModelCatalogEntry[];
  authStatus: ModelAuthStatusResult | null;
  defaultModel: { primary: string | null; fallbacks: string[] };
  /** Operation key while a save runs (e.g. "provider:openai", "default:<ref>"). */
  busy: string | null;
  error: string | null;
  /** Provider preset whose connect form is expanded. */
  expandedProvider: string | null;
  onClose: () => void;
  onExpandProvider: (id: string | null) => void;
  onConnectProvider: (
    id: string,
    input: { apiKey?: string; baseUrl?: string; modelId?: string },
  ) => void;
  onMakeDefault: (ref: string) => void;
  onToggleFallback: (ref: string) => void;
  onOpenAdvanced: () => void;
};

export type ProviderPreset = {
  id: string;
  label: string;
  desc: string;
  keyUrl?: string;
  keyHint?: string;
  placeholder?: string;
  /** No API key: local runtime the user installs themselves. */
  local?: boolean;
  /** Full custom form (base URL + model id). */
  custom?: boolean;
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    desc: "Claude models",
    keyUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "console.anthropic.com → Settings → API keys",
    placeholder: "sk-ant-…",
  },
  {
    id: "openai",
    label: "OpenAI",
    desc: "GPT models",
    keyUrl: "https://platform.openai.com/api-keys",
    keyHint: "platform.openai.com → API keys",
    placeholder: "sk-…",
  },
  {
    id: "google",
    label: "Google",
    desc: "Gemini models",
    keyUrl: "https://aistudio.google.com/apikey",
    keyHint: "aistudio.google.com → Get API key (free tier available)",
    placeholder: "AIza…",
  },
  {
    id: "groq",
    label: "Groq",
    desc: "Very fast, free tier",
    keyUrl: "https://console.groq.com/keys",
    keyHint: "console.groq.com → API Keys (free to start)",
    placeholder: "gsk_…",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    desc: "Many models, one key",
    keyUrl: "https://openrouter.ai/settings/keys",
    keyHint: "openrouter.ai → Keys",
    placeholder: "sk-or-…",
  },
  {
    id: "custom",
    label: "Custom server",
    desc: "LiteLLM · vLLM · Ollama · any OpenAI-compatible",
    custom: true,
  },
];

function providerAuthTone(
  authStatus: ModelAuthStatusResult | null,
  providerId: string,
): { tone: "ok" | "warn" | "bad" | "unknown"; label: string } {
  const entry = authStatus?.providers.find(
    (candidate) => candidate.provider.toLowerCase() === providerId.toLowerCase(),
  );
  if (!entry) {
    return { tone: "unknown", label: "not checked" };
  }
  switch (entry.status) {
    case "ok":
    case "static":
      return { tone: "ok", label: "key OK" };
    case "expiring":
      return {
        tone: "warn",
        label: entry.expiry ? `expires in ${entry.expiry.label}` : "expiring soon",
      };
    case "expired":
      return { tone: "bad", label: "key expired" };
    default:
      return { tone: "bad", label: "no key" };
  }
}

function focusFirstInputOnce(el?: Element) {
  const root = el as HTMLElement | undefined;
  if (root && root.dataset.autofocused !== "true") {
    root.dataset.autofocused = "true";
    root.querySelector<HTMLInputElement>("input")?.focus();
  }
}

function showDialogWhenClosed(el?: Element) {
  const dialog = el as HTMLDialogElement | undefined;
  if (!dialog || dialog.open || typeof dialog.showModal !== "function") {
    return;
  }
  if (dialog.isConnected) {
    dialog.showModal();
  } else {
    // Lit runs ref callbacks before the cloned template is inserted into the
    // document; showModal() on a detached dialog throws InvalidStateError.
    queueMicrotask(() => {
      if (dialog.isConnected && !dialog.open) {
        dialog.showModal();
      }
    });
  }
}

/** Friendly provider name for catalog rows ("litellm" → "LiteLLM"). */
export function providerDisplayName(providerId: string): string {
  const preset = PROVIDER_PRESETS.find((entry) => entry.id === providerId);
  return preset?.label ?? CUSTOM_PROVIDER_LABELS[providerId] ?? providerId;
}

function readField(root: HTMLElement, name: string): string {
  return (
    root
      .closest(".model-studio__connect")
      ?.querySelector<HTMLInputElement>(`input[data-field="${name}"]`)
      ?.value.trim() ?? ""
  );
}

function renderConnectForm(preset: ProviderPreset, props: ModelStudioProps) {
  // Custom servers connect under a user-chosen id, so match any provider save.
  const busy = props.busy !== null && props.busy.startsWith("provider:");
  const submit = (root: HTMLElement) => {
    if (preset.custom) {
      const name = readField(root, "providerName") || "custom";
      props.onConnectProvider(name.toLowerCase().replace(/[^a-z0-9_-]/g, ""), {
        baseUrl: readField(root, "baseUrl"),
        apiKey: readField(root, "apiKey"),
        modelId: readField(root, "modelId"),
      });
      return;
    }
    props.onConnectProvider(preset.id, { apiKey: readField(root, "apiKey") });
  };
  const onEnter = (event: KeyboardEvent) => {
    if (event.key === "Enter") {
      submit(event.currentTarget as HTMLElement);
    }
  };

  return html`
    <div class="model-studio__connect" ${ref(focusFirstInputOnce)}>
      ${preset.custom
        ? html`
            <label class="model-studio__field">
              <span>Name (anything short, e.g. litellm)</span>
              <input
                data-field="providerName"
                type="text"
                autocomplete="off"
                placeholder="litellm"
                ?disabled=${busy}
                @keydown=${onEnter}
              />
            </label>
            <label class="model-studio__field">
              <span>Server address</span>
              <input
                data-field="baseUrl"
                type="text"
                autocomplete="off"
                placeholder="http://127.0.0.1:4000/v1"
                ?disabled=${busy}
                @keydown=${onEnter}
              />
            </label>
            <label class="model-studio__field">
              <span>API key (only if your server needs one)</span>
              <input
                data-field="apiKey"
                type="password"
                autocomplete="off"
                placeholder="optional"
                ?disabled=${busy}
                @keydown=${onEnter}
              />
            </label>
            <label class="model-studio__field">
              <span>Model id (as your server names it)</span>
              <input
                data-field="modelId"
                type="text"
                autocomplete="off"
                placeholder="claude-sonnet-4-5"
                ?disabled=${busy}
                @keydown=${onEnter}
              />
            </label>
          `
        : html`
            <label class="model-studio__field">
              <span>API key</span>
              <input
                data-field="apiKey"
                type="password"
                autocomplete="off"
                placeholder=${preset.placeholder ?? "key"}
                ?disabled=${busy}
                @keydown=${onEnter}
              />
            </label>
            ${preset.keyUrl
              ? html`
                  <div class="model-studio__keyhint">
                    Get a key:
                    <a href=${preset.keyUrl} target="_blank" rel="noreferrer">
                      ${preset.keyHint ?? preset.keyUrl}</a
                    >. It is stored only in your own config file.
                  </div>
                `
              : nothing}
          `}
      <div class="model-studio__connect-actions">
        <button
          class="btn primary"
          ?disabled=${busy}
          @click=${(event: Event) => submit(event.currentTarget as HTMLElement)}
        >
          ${busy ? "Connecting…" : "Save & connect"}
        </button>
        <button class="btn" ?disabled=${busy} @click=${() => props.onExpandProvider(null)}>
          Cancel
        </button>
      </div>
    </div>
  `;
}

function renderModelRow(entry: ModelCatalogEntry, props: ModelStudioProps) {
  const entryRef = modelCatalogRef(entry);
  const isDefault = props.defaultModel.primary === entryRef;
  const fallbackIndex = props.defaultModel.fallbacks.indexOf(entryRef);
  // The gateway computes `available` from every credential source (config,
  // env vars, auth profiles) — trust it over the per-provider auth probe so
  // env-key providers (e.g. GROQ_API_KEY) read as connected, not "unknown".
  const auth =
    entry.available === true
      ? { tone: "ok" as const, label: "connected — key found" }
      : entry.available === false
        ? { tone: "bad" as const, label: "no key — connect the provider below to use it" }
        : providerAuthTone(props.authStatus, entry.provider);
  const rowBusy = props.busy === `default:${entryRef}` || props.busy === `fallback:${entryRef}`;

  return html`
    <div class="model-studio__row ${isDefault ? "model-studio__row--default" : ""}">
      <span class="model-brand-wrap" title="Provider credentials: ${auth.label}">
        ${renderModelBrandIcon(entry)}
        <span
          class="model-studio__dot model-studio__dot--${auth.tone} model-brand-wrap__dot"
        ></span>
      </span>
      <span class="model-studio__row-main">
        <span class="model-studio__row-name">${entry.name || entry.id}</span>
        <span class="model-studio__row-meta">${providerDisplayName(entry.provider)}</span>
      </span>
      ${isDefault
        ? html`<span class="model-studio__badge">Default</span>`
        : html`
            <button
              class="btn btn--sm model-studio__row-action"
              ?disabled=${rowBusy || props.busy !== null}
              @click=${() => props.onMakeDefault(entryRef)}
            >
              ${props.busy === `default:${entryRef}` ? "Saving…" : "Make default"}
            </button>
          `}
      ${!isDefault
        ? html`
            <button
              class="btn btn--sm model-studio__row-action ${fallbackIndex >= 0
                ? "model-studio__row-action--active"
                : ""}"
              title=${fallbackIndex >= 0
                ? "Remove from backups"
                : "Use automatically if the default fails"}
              ?disabled=${rowBusy || props.busy !== null}
              @click=${() => props.onToggleFallback(entryRef)}
            >
              ${fallbackIndex >= 0 ? `Backup #${fallbackIndex + 1} ✓` : "Backup"}
            </button>
          `
        : nothing}
    </div>
  `;
}

export function renderModelStudio(props: ModelStudioProps) {
  if (!props.open) {
    return nothing;
  }
  const defaultEntry = props.catalog.find(
    (entry) => modelCatalogRef(entry) === props.defaultModel.primary,
  );

  return html`
    <dialog
      class="md-preview-dialog ch-dialog model-studio"
      ${ref(showDialogWhenClosed)}
      @click=${(e: Event) => {
        if (e.target === e.currentTarget) {
          (e.currentTarget as HTMLDialogElement).close();
        }
      }}
      @close=${() => props.onClose()}
    >
      <div class="md-preview-dialog__panel">
        <div class="md-preview-dialog__header">
          <div class="md-preview-dialog__header-main">
            <span class="md-preview-dialog__eyebrow">AI Models</span>
            <div class="ch-dialog__titlerow">
              <span class="md-preview-dialog__title">Your assistant's brain</span>
            </div>
          </div>
          <button
            class="ch-dialog__close"
            title="Close"
            aria-label="Close"
            @click=${(e: Event) => {
              (e.currentTarget as HTMLElement).closest("dialog")?.close();
            }}
          >
            ${icons.x}
          </button>
        </div>
        <div class="md-preview-dialog__body ch-dialog__body">
          <p class="model-studio__lede">
            One default model answers every chat. Backups take over automatically if it fails, so
            replies keep flowing.
          </p>

          ${props.error
            ? html`<div class="callout danger" style="margin-bottom: 12px;">${props.error}</div>`
            : nothing}

          <div class="model-studio__section-title">Default model</div>
          ${props.defaultModel.primary
            ? html`
                <div class="model-studio__hero">
                  <span class="model-studio__hero-icon">${icons.sparkles}</span>
                  <span class="model-studio__hero-main">
                    <span class="model-studio__hero-name">
                      ${defaultEntry?.name ?? props.defaultModel.primary}
                    </span>
                    <span class="model-studio__hero-meta">
                      ${defaultEntry
                        ? `via ${providerDisplayName(defaultEntry.provider)}`
                        : "not in the current catalog"}
                      ${props.defaultModel.fallbacks.length > 0
                        ? ` · ${props.defaultModel.fallbacks.length} backup${
                            props.defaultModel.fallbacks.length === 1 ? "" : "s"
                          }`
                        : ""}
                    </span>
                  </span>
                </div>
              `
            : html`
                <div class="muted" style="font-size: 12.5px;">
                  No default set — pick one from the list below.
                </div>
              `}

          <div class="model-studio__section-title">Your models</div>
          ${props.loading && props.catalog.length === 0
            ? html`<div class="muted" style="font-size: 12.5px;">Loading models…</div>`
            : props.catalog.length === 0
              ? html`<div class="muted" style="font-size: 12.5px;">
                  No models yet — connect a provider below.
                </div>`
              : html`
                  <div class="model-studio__list">
                    ${props.catalog.map((entry) => renderModelRow(entry, props))}
                  </div>
                `}

          <div class="model-studio__section-title">Add a provider</div>
          <div class="model-studio__providers">
            ${PROVIDER_PRESETS.map((preset) => {
              const expanded = props.expandedProvider === preset.id;
              const auth = providerAuthTone(props.authStatus, preset.id);
              return html`
                <div
                  class="model-studio__provider ${expanded ? "model-studio__provider--open" : ""}"
                >
                  <button
                    class="model-studio__provider-head"
                    @click=${() => props.onExpandProvider(expanded ? null : preset.id)}
                  >
                    ${renderProviderBrandIcon(preset.id)}
                    <span class="model-studio__provider-name">${preset.label}</span>
                    <span class="model-studio__provider-desc">${preset.desc}</span>
                    ${auth.tone === "ok"
                      ? html`<span class="model-studio__dot model-studio__dot--ok"></span>`
                      : nothing}
                  </button>
                  ${expanded ? renderConnectForm(preset, props) : nothing}
                </div>
              `;
            })}
          </div>

          <div class="model-studio__footer">
            <span class="model-studio__tip">
              Tip: in any chat, type <code>/model</code> to switch models for that conversation.
            </span>
            <button class="btn btn--sm" @click=${() => props.onOpenAdvanced()}>
              Advanced settings
            </button>
          </div>
        </div>
      </div>
    </dialog>
  `;
}
