// Control UI view renders the per-channel allowed-contacts manager.
import { html, nothing } from "lit";
import { ref } from "lit/directives/ref.js";
import { confirmDialog } from "../confirm-dialog.ts";
import { CONTACT_LABEL_CHANNELS } from "../controllers/channels.ts";
import { icons } from "../icons.ts";
import { showToast } from "../toast.ts";
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

function readContactLabels(props: ChannelsProps, channelId: string): Record<string, string> {
  const channelConfig = props.configForm
    ? resolveChannelConfigValue(props.configForm, channelId)
    : null;
  const raw = channelConfig?.contactLabels;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }
  const labels: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim()) {
      labels[key] = value.trim();
    }
  }
  return labels;
}

function readDmPolicy(props: ChannelsProps, channelId: string): string {
  const channelConfig = props.configForm
    ? resolveChannelConfigValue(props.configForm, channelId)
    : null;
  const raw = channelConfig?.dmPolicy;
  return typeof raw === "string" && raw.trim() ? raw.trim() : "pairing";
}

/** CSS.escape with a fallback for test environments that lack the CSS global. */
function escapeSelector(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function findNameInput(root: HTMLElement, channelId: string): HTMLInputElement | null {
  return (
    root
      .closest(".contacts-add")
      ?.querySelector<HTMLInputElement>(`#${escapeSelector(`contact-name-${channelId}`)}`) ?? null
  );
}

function buildSingleLabel(
  values: string[],
  nameInput: HTMLInputElement | null,
): Record<string, string> | undefined {
  // A single typed name can only describe a single contact — ignore it for bulk pastes.
  const name = nameInput?.value.trim() ?? "";
  if (!name || values.length !== 1) {
    return undefined;
  }
  return { [values[0]]: name };
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
  const nameInput = findNameInput(input, channelId);
  props.onContactsAdd(channelId, tokens, buildSingleLabel(tokens, nameInput));
  input.value = "";
  if (nameInput) {
    nameInput.value = "";
  }
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
  const nameInput = findNameInput(input, channelId);
  props.onContactsAdd(channelId, numbers, buildSingleLabel(numbers, nameInput));
  input.value = "";
  if (nameInput) {
    nameInput.value = "";
  }
}

function normalizePhoneToken(token: string, dial: string): string | null {
  const cleaned = token.replace(/[\s\-().]/g, "");
  const full = cleaned.startsWith("+") ? cleaned : `${dial}${cleaned.replace(/^0+/, "")}`;
  return /^\+\d{6,15}$/.test(full) ? full : null;
}

type ImportedContact = { number: string; name?: string };

/** Pulls named contacts out of a vCard export: FN/N gives the name, TEL lines give numbers. */
function parseVCardContacts(text: string, dial: string): ImportedContact[] {
  const results: ImportedContact[] = [];
  const cards = text.split(/BEGIN:VCARD/i).slice(1);
  for (const card of cards) {
    const fn = card.match(/^FN(?:;[^:]*)?:(.+)$/im)?.[1]?.trim();
    let name = fn;
    if (!name) {
      // N is "Last;First;Middle;Prefix;Suffix" — reassemble as "First Last".
      const n = card.match(/^N(?:;[^:]*)?:(.+)$/im)?.[1];
      if (n) {
        const parts = n.split(";").map((part) => part.trim());
        name = [parts[1], parts[0]].filter(Boolean).join(" ").trim() || undefined;
      }
    }
    for (const line of card.match(/^TEL(?:;[^:]*)?:(.+)$/gim) ?? []) {
      const normalized = normalizePhoneToken(line.slice(line.indexOf(":") + 1), dial);
      if (normalized) {
        results.push({ number: normalized, ...(name ? { name } : {}) });
      }
    }
  }
  return results;
}

/** RFC 4180-style CSV split: quoted fields, escaped quotes, commas inside quotes, CR/LF rows. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  rows.push(row);
  return rows.filter((cells) => cells.some((cell) => cell.trim().length > 0));
}

type CsvColumnMap = { nameIdx: number; firstIdx: number; lastIdx: number; phoneIdxs: number[] };

/**
 * Recognize a contacts-export header row (Google Contacts, Outlook, or a plain
 * name/number file with headers). Returns null when the first row is data.
 */
function detectCsvColumns(header: string[]): CsvColumnMap | null {
  const normalized = header.map((cell) => cell.trim().toLowerCase());
  const findIdx = (test: (cell: string) => boolean) => normalized.findIndex(test);

  const nameIdx = findIdx((cell) => /^(name|full ?name|display ?name)$/.test(cell));
  const firstIdx = findIdx((cell) => /^(first ?name|given ?name)$/.test(cell));
  const lastIdx = findIdx((cell) => /^(last ?name|family ?name|surname)$/.test(cell));
  const phoneIdxs = normalized.flatMap((cell, index) =>
    /(phone|mobile|tel\b|telephone|number)/.test(cell) && !/type|label|format/.test(cell)
      ? [index]
      : [],
  );

  if (phoneIdxs.length === 0 || (nameIdx === -1 && firstIdx === -1 && lastIdx === -1)) {
    return null;
  }
  return { nameIdx, firstIdx, lastIdx, phoneIdxs };
}

function resolveCsvRowName(cells: string[], columns: CsvColumnMap): string | undefined {
  const direct = columns.nameIdx >= 0 ? cells[columns.nameIdx]?.trim() : "";
  if (direct) {
    return direct;
  }
  const first = columns.firstIdx >= 0 ? cells[columns.firstIdx]?.trim() : "";
  const last = columns.lastIdx >= 0 ? cells[columns.lastIdx]?.trim() : "";
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || undefined;
}

/** Google Contacts joins multiple values in one column with " ::: ". */
function splitPhoneCell(cell: string): string[] {
  return cell
    .split(/\s*:::\s*|;/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

/** One free-form line ("Aasrith, +91 93812 41869") → contacts, pairing leftover text as the name. */
function parseContactLine(line: string, dial: string): ImportedContact[] {
  const matches = [...line.matchAll(/\+?\d[\d\s\-().]{5,}\d/g)];
  if (matches.length === 1) {
    const normalized = normalizePhoneToken(matches[0][0], dial);
    if (!normalized) {
      return [];
    }
    const name = line
      .replace(matches[0][0], "")
      .replace(/["']/g, "")
      .replace(/[,;\t]+/g, " ")
      .trim();
    return [{ number: normalized, ...(/\p{L}/u.test(name) ? { name } : {}) }];
  }
  const results: ImportedContact[] = [];
  for (const match of matches) {
    const normalized = normalizePhoneToken(match[0], dial);
    if (normalized) {
      results.push({ number: normalized });
    }
  }
  return results;
}

/**
 * CSV/plain-text contact extraction. Handles, in order of preference:
 * - exports with a header row (Google Contacts "Phone 1 - Value", Outlook
 *   "Mobile Phone", or a simple "Name,Number" header) — every number in a row
 *   gets that row's name;
 * - headerless rows ("Aasrith,+91 93812 41869");
 * - loose text lines and numbers-only files.
 */
function parseCsvContacts(text: string, dial: string): ImportedContact[] {
  const rows = parseCsvRows(text);
  if (rows.length === 0) {
    return [];
  }

  const columns = detectCsvColumns(rows[0]);
  if (columns) {
    const results: ImportedContact[] = [];
    for (const cells of rows.slice(1)) {
      const name = resolveCsvRowName(cells, columns);
      for (const phoneIdx of columns.phoneIdxs) {
        for (const token of splitPhoneCell(cells[phoneIdx] ?? "")) {
          const normalized = normalizePhoneToken(token, dial);
          if (normalized) {
            results.push({ number: normalized, ...(name ? { name } : {}) });
          }
        }
      }
    }
    return results;
  }

  const results: ImportedContact[] = [];
  for (const cells of rows) {
    if (cells.length === 1) {
      results.push(...parseContactLine(cells[0], dial));
      continue;
    }
    // Headerless multi-column row: phone-like cells are numbers, and when the
    // row has exactly one text cell it names all of them.
    const numbers: string[] = [];
    const textCells: string[] = [];
    for (const cell of cells) {
      const trimmed = cell.trim();
      if (!trimmed) {
        continue;
      }
      const normalized = normalizePhoneToken(trimmed, dial);
      if (normalized) {
        numbers.push(normalized);
      } else if (/\p{L}/u.test(trimmed) && !trimmed.includes("@") && !/https?:/i.test(trimmed)) {
        // Emails/URLs are ignored so they never masquerade as the person's name.
        textCells.push(trimmed);
      }
    }
    const name = textCells.length === 1 ? textCells[0] : undefined;
    for (const number of numbers) {
      results.push({ number, ...(name ? { name } : {}) });
    }
  }
  return results;
}

/** Exported for tests. */
export function extractContactsFromText(text: string, dial: string): ImportedContact[] {
  const parsed = /BEGIN:VCARD/i.test(text)
    ? parseVCardContacts(text, dial)
    : parseCsvContacts(text, dial);
  // Dedupe by number; a named entry beats an unnamed duplicate.
  const byNumber = new Map<string, ImportedContact>();
  for (const contact of parsed) {
    const existing = byNumber.get(contact.number);
    if (!existing || (!existing.name && contact.name)) {
      byNumber.set(contact.number, contact);
    }
  }
  return [...byNumber.values()];
}

function importContactsFile(params: {
  channelId: string;
  props: ChannelsProps;
  dial: string;
  withNames: boolean;
}) {
  const { channelId, props, dial, withNames } = params;
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".txt,.csv,.vcf,text/plain,text/csv,text/vcard";
  picker.addEventListener("change", () => {
    const file = picker.files?.[0];
    if (!file) {
      return;
    }
    void file.text().then(async (text) => {
      const contacts = extractContactsFromText(text, dial);
      if (contacts.length === 0) {
        showToast("No phone numbers found in that file.", { tone: "error" });
        return;
      }
      const preview = contacts
        .slice(0, 8)
        .map((contact) => (contact.name ? `${contact.name} — ${contact.number}` : contact.number))
        .join("\n");
      const rest = contacts.length > 8 ? `\n…and ${contacts.length - 8} more` : "";
      const confirmed = await confirmDialog({
        title: "Import contacts",
        message: `Add ${contacts.length} contact${contacts.length === 1 ? "" : "s"} to allowed contacts?\n\n${preview}${rest}`,
        confirmLabel: contacts.length === 1 ? "Add contact" : "Add contacts",
        danger: false,
      });
      if (!confirmed) {
        return;
      }
      const numbers = contacts.map((contact) => contact.number);
      const labels: Record<string, string> = {};
      if (withNames) {
        for (const contact of contacts) {
          if (contact.name) {
            labels[contact.number] = contact.name;
          }
        }
      }
      props.onContactsAdd(channelId, numbers, Object.keys(labels).length > 0 ? labels : undefined);
    });
  });
  picker.click();
}

function renderNameField(params: { channelId: string; busy: boolean }) {
  const { channelId, busy } = params;
  return html`
    <input
      id=${`contact-name-${channelId}`}
      class="contacts-input contacts-name"
      type="text"
      autocomplete="off"
      placeholder="Name (optional) — so you remember who this is"
      ?disabled=${busy}
    />
  `;
}

function renderPhoneAddRow(params: {
  channelId: string;
  props: ChannelsProps;
  busy: boolean;
  canLabel: boolean;
}) {
  const { channelId, props, busy, canLabel } = params;
  const adding = busy && props.contactsBusyOp === "add";
  const inputId = `contact-input-${channelId}`;
  const selectId = `contact-cc-${channelId}`;
  const selectedDial = defaultCountryDial();
  const findSelect = (root: HTMLElement) =>
    root
      .closest(".contacts-add")
      ?.querySelector<HTMLSelectElement>(`#${escapeSelector(selectId)}`) ?? null;

  return html`
    <div class="contacts-add" style="margin-top: 10px;">
      ${canLabel ? renderNameField({ channelId, busy }) : nothing}
      <div class="row contacts-add__row" style="gap: 8px;">
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
              ?.querySelector<HTMLInputElement>(`#${escapeSelector(inputId)}`);
            if (input) {
              submitPhoneContact(props, channelId, input, findSelect(root));
            }
          }}
        >
          ${adding ? "Adding…" : "Add"}
        </button>
        <button
          class="btn"
          title="Import contacts from a .txt, .csv, or .vcf (vCard) file — names are picked up automatically"
          ?disabled=${busy}
          @click=${(event: Event) => {
            const root = event.currentTarget as HTMLElement;
            importContactsFile({
              channelId,
              props,
              dial: findSelect(root)?.value ?? defaultCountryDial(),
              withNames: canLabel,
            });
          }}
        >
          Import…
        </button>
      </div>
    </div>
  `;
}

/** Confirm, delete, and report the outcome as a toast. */
function confirmContactDelete(params: {
  channelId: string;
  props: ChannelsProps;
  contact: string;
  label: string | undefined;
}) {
  const { channelId, props, contact, label } = params;
  const display = label ? `${label} (${contact})` : contact;
  let removed = false;
  void confirmDialog({
    title: "Delete contact",
    message: `Delete ${display} from allowed contacts? They will stop getting replies until you add them again.`,
    confirmLabel: "Delete",
    loadingLabel: "Deleting…",
    onConfirm: async () => {
      removed = await props.onContactRemove(channelId, contact);
    },
  }).then((confirmed) => {
    if (!confirmed) {
      return;
    }
    if (removed) {
      showToast(`${display} deleted`, { tone: "success" });
    } else {
      showToast(`Couldn't delete ${display} — see the error under the contact list.`, {
        tone: "error",
      });
    }
  });
}

/** Focus the inline name editor once when it first appears (not on every re-render). */
function focusNameEditorOnce(el?: Element) {
  const input = el as HTMLInputElement | undefined;
  if (input && input.dataset.autofocused !== "true") {
    input.dataset.autofocused = "true";
    input.focus();
    input.select();
  }
}

function renderContactRow(params: {
  channelId: string;
  props: ChannelsProps;
  contact: string;
  label: string | undefined;
  busy: boolean;
  canLabel: boolean;
}) {
  const { channelId, props, contact, label, busy, canLabel } = params;
  const editing = props.contactEditKey === `${channelId}:${contact}`;
  const removing = busy && props.contactsBusyOp === "remove";

  if (editing) {
    const save = (input: HTMLInputElement) => {
      props.onContactRename(channelId, contact, input.value);
    };
    return html`
      <div class="contacts-list__row contacts-list__row--editing">
        <span class="contacts-list__value">${contact}</span>
        <input
          class="contacts-input contacts-list__name-input"
          type="text"
          autocomplete="off"
          placeholder="Name"
          .value=${label ?? ""}
          ?disabled=${busy}
          ${ref(focusNameEditorOnce)}
          @keydown=${(event: KeyboardEvent) => {
            if (event.key === "Enter") {
              save(event.currentTarget as HTMLInputElement);
            } else if (event.key === "Escape") {
              props.onContactEditCancel();
            }
          }}
        />
        <button
          class="btn primary"
          ?disabled=${busy}
          @click=${(event: Event) => {
            const input = (event.currentTarget as HTMLElement)
              .closest(".contacts-list__row")
              ?.querySelector<HTMLInputElement>(".contacts-list__name-input");
            if (input) {
              save(input);
            }
          }}
        >
          ${busy && props.contactsBusyOp === "rename" ? "Saving…" : "Save"}
        </button>
        <button class="btn" ?disabled=${busy} @click=${() => props.onContactEditCancel()}>
          Cancel
        </button>
      </div>
    `;
  }

  return html`
    <div class="contacts-list__row">
      <div class="contacts-list__info">
        ${label ? html`<span class="contacts-list__name">${label}</span>` : nothing}
        <span class="contacts-list__value">${contact}</span>
      </div>
      <div class="contacts-list__actions">
        ${canLabel
          ? label
            ? html`
                <button
                  class="contacts-list__iconbtn"
                  title="Edit name"
                  aria-label="Edit name"
                  ?disabled=${busy}
                  @click=${() => props.onContactEditStart(channelId, contact)}
                >
                  ${icons.edit}
                </button>
              `
            : html`
                <button
                  class="contacts-list__addname"
                  ?disabled=${busy}
                  @click=${() => props.onContactEditStart(channelId, contact)}
                >
                  Add name
                </button>
              `
          : nothing}
        <button
          class="contacts-list__delete"
          title="Delete contact"
          ?disabled=${busy}
          @click=${() => confirmContactDelete({ channelId, props, contact, label })}
        >
          ${removing ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  `;
}

export function renderAllowedContactsSection(params: { channelId: string; props: ChannelsProps }) {
  const { channelId, props } = params;
  const contacts = readAllowFrom(props, channelId);
  const dmPolicy = readDmPolicy(props, channelId);
  const busy = props.contactsBusy === channelId;
  const adding = busy && props.contactsBusyOp === "add";
  const isPhoneChannel = PHONE_CONTACT_CHANNELS.has(channelId);
  const canLabel = CONTACT_LABEL_CHANNELS.has(channelId);
  const labels = canLabel ? readContactLabels(props, channelId) : {};
  const inputId = `contact-input-${channelId}`;
  const placeholder = CONTACT_PLACEHOLDERS[channelId] ?? "user id";

  return html`
    <div class="contacts-section" style="margin-top: 16px;">
      <div class="card-title" style="font-size: 0.875rem;">Allowed contacts</div>
      <div class="card-sub">These senders get replies immediately — no pairing approval.</div>

      ${contacts.length > 0
        ? html`
            <div class="contacts-list" style="margin-top: 10px;">
              ${contacts.map((contact) =>
                renderContactRow({
                  channelId,
                  props,
                  contact,
                  label: labels[contact],
                  busy,
                  canLabel,
                }),
              )}
            </div>
          `
        : html`<div class="muted" style="margin-top: 10px; font-size: 0.8125rem;">
            No contacts yet — add a number below.
          </div>`}
      ${isPhoneChannel
        ? renderPhoneAddRow({ channelId, props, busy, canLabel })
        : html`
            <div class="contacts-add" style="margin-top: 10px;">
              ${canLabel ? renderNameField({ channelId, busy }) : nothing}
              <div class="row contacts-add__row" style="gap: 8px;">
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
                      ?.querySelector<HTMLInputElement>(`#${escapeSelector(inputId)}`);
                    if (input) {
                      submitContact(props, channelId, input);
                    }
                  }}
                >
                  ${adding ? "Adding…" : "Add"}
                </button>
              </div>
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
