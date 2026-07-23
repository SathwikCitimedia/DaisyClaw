// Control UI view renders the per-channel allowed-contacts manager.
import { html, nothing } from "lit";
import { resolveChannelConfigValue } from "./channel-config-extras.ts";
import type { ChannelsProps } from "./channels.types.ts";

const DM_POLICY_OPTIONS = [
  { value: "allowlist", label: "Only my contacts" },
  { value: "pairing", label: "Contacts + pairing code" },
  { value: "open", label: "Everyone" },
  { value: "disabled", label: "Nobody (DMs off)" },
] as const;

const CONTACT_PLACEHOLDERS: Record<string, string> = {
  telegram: "123456789 (user ID)",
  discord: "123456789012345678 (user ID)",
};

/** Channels whose contact ids are phone numbers — these get the country-code picker. */
const PHONE_CONTACT_CHANNELS = new Set(["whatsapp", "signal", "sms", "imessage"]);

type CountryEntry = { region: string; name: string; dial: string; flag: string };

const COUNTRY_CODES: CountryEntry[] = [
  { region: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" },
  { region: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { region: "AT", name: "Austria", dial: "+43", flag: "🇦🇹" },
  { region: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { region: "BE", name: "Belgium", dial: "+32", flag: "🇧🇪" },
  { region: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { region: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { region: "CL", name: "Chile", dial: "+56", flag: "🇨🇱" },
  { region: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { region: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴" },
  { region: "CZ", name: "Czechia", dial: "+420", flag: "🇨🇿" },
  { region: "DK", name: "Denmark", dial: "+45", flag: "🇩🇰" },
  { region: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { region: "FI", name: "Finland", dial: "+358", flag: "🇫🇮" },
  { region: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { region: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { region: "GR", name: "Greece", dial: "+30", flag: "🇬🇷" },
  { region: "HK", name: "Hong Kong", dial: "+852", flag: "🇭🇰" },
  { region: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { region: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { region: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { region: "IL", name: "Israel", dial: "+972", flag: "🇮🇱" },
  { region: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { region: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { region: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { region: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { region: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { region: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { region: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { region: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { region: "NO", name: "Norway", dial: "+47", flag: "🇳🇴" },
  { region: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { region: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { region: "PL", name: "Poland", dial: "+48", flag: "🇵🇱" },
  { region: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { region: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { region: "RO", name: "Romania", dial: "+40", flag: "🇷🇴" },
  { region: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
  { region: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { region: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { region: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { region: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { region: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { region: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰" },
  { region: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { region: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { region: "TW", name: "Taiwan", dial: "+886", flag: "🇹🇼" },
  { region: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { region: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { region: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { region: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { region: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { region: "VN", name: "Vietnam", dial: "+84", flag: "🇻🇳" },
];

const LAST_COUNTRY_STORAGE_KEY = "daisyclaw.contacts.countryDial";

function readStoredCountryDial(): string | null {
  try {
    return globalThis.localStorage?.getItem(LAST_COUNTRY_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function storeCountryDial(dial: string) {
  try {
    globalThis.localStorage?.setItem(LAST_COUNTRY_STORAGE_KEY, dial);
  } catch {
    // Storage unavailable — selection just won't persist.
  }
}

function defaultCountryDial(): string {
  const stored = readStoredCountryDial();
  if (stored && COUNTRY_CODES.some((entry) => entry.dial === stored)) {
    return stored;
  }
  const region = (globalThis.navigator?.language ?? "").split("-")[1]?.toUpperCase();
  const match = region ? COUNTRY_CODES.find((entry) => entry.region === region) : undefined;
  return match?.dial ?? "+1";
}

function readAllowFrom(props: ChannelsProps, channelId: string): string[] {
  const channelConfig = props.configForm
    ? resolveChannelConfigValue(props.configForm, channelId)
    : null;
  const raw = channelConfig?.allowFrom;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((entry) => String(entry).trim()).filter((entry) => entry.length > 0);
}

function readDmPolicy(props: ChannelsProps, channelId: string): string {
  const channelConfig = props.configForm
    ? resolveChannelConfigValue(props.configForm, channelId)
    : null;
  const raw = channelConfig?.dmPolicy;
  return typeof raw === "string" && raw.trim() ? raw.trim() : "pairing";
}

function submitContact(props: ChannelsProps, channelId: string, input: HTMLInputElement) {
  const value = input.value.trim();
  if (!value) {
    return;
  }
  const tokens = value
    .split(/[,;\n]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return;
  }
  props.onContactsAdd(channelId, tokens);
  input.value = "";
}

function submitPhoneContact(
  props: ChannelsProps,
  channelId: string,
  input: HTMLInputElement,
  select: HTMLSelectElement | null,
) {
  const raw = input.value.trim();
  if (!raw) {
    return;
  }
  const dial = select?.value ?? defaultCountryDial();
  // Bulk paste: commas, semicolons, and newlines separate multiple numbers.
  const tokens = raw
    .split(/[,;\n]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const numbers: string[] = [];
  for (const token of tokens) {
    const full = normalizePhoneToken(token, dial);
    if (!full) {
      input.setCustomValidity(`"${token}" is not a valid phone number (digits only).`);
      input.reportValidity();
      return;
    }
    numbers.push(full);
  }
  if (numbers.length === 0) {
    return;
  }
  input.setCustomValidity("");
  props.onContactsAdd(channelId, numbers);
  input.value = "";
}

function normalizePhoneToken(token: string, dial: string): string | null {
  const cleaned = token.replace(/[\s\-().]/g, "");
  const full = cleaned.startsWith("+") ? cleaned : `${dial}${cleaned.replace(/^0+/, "")}`;
  return /^\+\d{6,15}$/.test(full) ? full : null;
}

/** Pulls phone numbers out of a pasted/imported file: vCard TEL lines or any phone-like tokens. */
function extractPhoneNumbersFromText(text: string, dial: string): string[] {
  const numbers = new Set<string>();
  const telLines = text.match(/^TEL[^:]*:(.+)$/gim);
  if (telLines) {
    for (const line of telLines) {
      const value = line.slice(line.indexOf(":") + 1);
      const normalized = normalizePhoneToken(value, dial);
      if (normalized) {
        numbers.add(normalized);
      }
    }
  }
  if (numbers.size === 0) {
    for (const match of text.matchAll(/\+?\d[\d\s\-().]{5,}\d/g)) {
      const normalized = normalizePhoneToken(match[0], dial);
      if (normalized) {
        numbers.add(normalized);
      }
    }
  }
  return [...numbers];
}

function importContactsFile(params: { channelId: string; props: ChannelsProps; dial: string }) {
  const { channelId, props, dial } = params;
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".txt,.csv,.vcf,text/plain,text/csv,text/vcard";
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (!file) {
      return;
    }
    void file.text().then((text) => {
      const numbers = extractPhoneNumbersFromText(text, dial);
      if (numbers.length === 0) {
        globalThis.alert("No phone numbers found in that file.");
        return;
      }
      const confirmed = globalThis.confirm(
        `Add ${numbers.length} number${numbers.length === 1 ? "" : "s"} to allowed contacts?\n\n${numbers.slice(0, 10).join("\n")}${numbers.length > 10 ? "\n…" : ""}`,
      );
      if (confirmed) {
        props.onContactsAdd(channelId, numbers);
      }
    });
  });
  picker.click();
}

function renderPhoneAddRow(params: { channelId: string; props: ChannelsProps; busy: boolean }) {
  const { channelId, props, busy } = params;
  const inputId = `contact-input-${channelId}`;
  const selectId = `contact-cc-${channelId}`;
  const selectedDial = defaultCountryDial();
  const findSelect = (root: HTMLElement) =>
    root.closest(".contacts-add")?.querySelector<HTMLSelectElement>(`#${CSS.escape(selectId)}`) ??
    null;

  return html`
    <div class="row contacts-add" style="margin-top: 10px; gap: 8px;">
      <select
        id=${selectId}
        class="contacts-cc"
        aria-label="Country code"
        ?disabled=${busy}
        @change=${(event: Event) => {
          storeCountryDial((event.currentTarget as HTMLSelectElement).value);
        }}
      >
        ${COUNTRY_CODES.map(
          (entry) => html`
            <option
              value=${entry.dial}
              ?selected=${entry.dial === selectedDial}
              title=${entry.name}
            >
              ${entry.flag} ${entry.dial} ${entry.name}
            </option>
          `,
        )}
      </select>
      <input
        id=${inputId}
        class="contacts-input"
        type="tel"
        inputmode="tel"
        placeholder="98765 43210 — paste many, separated by commas"
        ?disabled=${busy}
        @input=${(event: Event) => {
          (event.currentTarget as HTMLInputElement).setCustomValidity("");
        }}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === "Enter") {
            const input = event.currentTarget as HTMLInputElement;
            submitPhoneContact(props, channelId, input, findSelect(input));
          }
        }}
      />
      <button
        class="btn primary"
        ?disabled=${busy}
        @click=${(event: Event) => {
          const root = event.currentTarget as HTMLElement;
          const input = root
            .closest(".contacts-add")
            ?.querySelector<HTMLInputElement>(`#${CSS.escape(inputId)}`);
          if (input) {
            submitPhoneContact(props, channelId, input, findSelect(root));
          }
        }}
      >
        ${busy ? "Adding…" : "Add"}
      </button>
      <button
        class="btn"
        title="Import numbers from a .txt, .csv, or .vcf (vCard) file"
        ?disabled=${busy}
        @click=${(event: Event) => {
          const root = event.currentTarget as HTMLElement;
          importContactsFile({
            channelId,
            props,
            dial: findSelect(root)?.value ?? defaultCountryDial(),
          });
        }}
      >
        Import…
      </button>
    </div>
  `;
}

export function renderAllowedContactsSection(params: { channelId: string; props: ChannelsProps }) {
  const { channelId, props } = params;
  const contacts = readAllowFrom(props, channelId);
  const dmPolicy = readDmPolicy(props, channelId);
  const busy = props.contactsBusy === channelId;
  const isPhoneChannel = PHONE_CONTACT_CHANNELS.has(channelId);
  const inputId = `contact-input-${channelId}`;
  const placeholder = CONTACT_PLACEHOLDERS[channelId] ?? "user id";

  return html`
    <div class="contacts-section" style="margin-top: 16px;">
      <div class="card-title" style="font-size: 0.875rem;">Allowed contacts</div>
      <div class="card-sub">These senders get replies immediately — no pairing approval.</div>

      ${contacts.length > 0
        ? html`
            <div class="contacts-list" style="margin-top: 10px;">
              ${contacts.map(
                (contact) => html`
                  <div class="contacts-list__row">
                    <span class="contacts-list__value">${contact}</span>
                    <button
                      class="contacts-list__remove"
                      title="Remove contact"
                      aria-label="Remove contact"
                      ?disabled=${busy}
                      @click=${() => props.onContactRemove(channelId, contact)}
                    >
                      ×
                    </button>
                  </div>
                `,
              )}
            </div>
          `
        : html`<div class="muted" style="margin-top: 10px; font-size: 0.8125rem;">
            No contacts yet — add a number below.
          </div>`}
      ${isPhoneChannel
        ? renderPhoneAddRow({ channelId, props, busy })
        : html`
            <div class="row contacts-add" style="margin-top: 10px; gap: 8px;">
              <input
                id=${inputId}
                class="contacts-input"
                type="text"
                placeholder=${placeholder}
                ?disabled=${busy}
                @keydown=${(event: KeyboardEvent) => {
                  if (event.key === "Enter") {
                    submitContact(props, channelId, event.currentTarget as HTMLInputElement);
                  }
                }}
              />
              <button
                class="btn primary"
                ?disabled=${busy}
                @click=${(event: Event) => {
                  const input = (event.currentTarget as HTMLElement)
                    .closest(".contacts-add")
                    ?.querySelector<HTMLInputElement>(`#${CSS.escape(inputId)}`);
                  if (input) {
                    submitContact(props, channelId, input);
                  }
                }}
              >
                ${busy ? "Adding…" : "Add"}
              </button>
            </div>
          `}

      <div class="row" style="margin-top: 12px; gap: 8px; align-items: center;">
        <span class="label" style="font-size: 0.8125rem;">Who can message</span>
        <select
          class="contacts-policy"
          ?disabled=${busy}
          @change=${(event: Event) => {
            props.onDmPolicyChange(channelId, (event.currentTarget as HTMLSelectElement).value);
          }}
        >
          ${DM_POLICY_OPTIONS.map(
            (option) => html`
              <option value=${option.value} ?selected=${option.value === dmPolicy}>
                ${option.label}
              </option>
            `,
          )}
        </select>
      </div>

      ${props.contactsError
        ? html`<div class="callout danger" style="margin-top: 10px;">${props.contactsError}</div>`
        : nothing}
    </div>
  `;
}
