// The Settings spending card: what Daisy has cost this month, and the ceiling.
//
// The money goes straight to the user's own AI provider, so this is not a bill
// from us. It is the only price they pay, and they read it in their own
// currency: providers bill in US dollars, so the card converts at the day's
// rate and says so.
import { html, nothing, type TemplateResult } from "lit";
import type {
  SpendingDisplay,
  SpendingLoadState,
  SpendingSaveState,
  SpendingStatus,
} from "../controllers/spending.ts";
import { icons } from "../icons.ts";

export type SpendingCardProps = {
  status: SpendingStatus | null;
  load: SpendingLoadState;
  save: SpendingSaveState;
  /** The new limit in the currency shown, or null for none. */
  onLimitChange: (amount: number | null) => void;
  onCurrencyChange: (currency: string) => void;
  onRetry: () => void;
};

/** An amount written the way its readers expect, e.g. ₹1,23,456.50. */
export function formatMoney(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function formatDollars(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function currencySymbol(currency: string, locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).formatToParts(0);
    return parts.find((part) => part.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

function currencyName(currency: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "currency" }).of(currency) ?? currency;
  } catch {
    return currency;
  }
}

function formatRateDate(date: string, locale: string): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) {
    return date;
  }
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(parsed);
}

/** A plain number for the box, without grouping, so it reads back as typed. */
function limitInputValue(limit: number | null): string {
  return limit == null ? "" : String(Math.round(limit * 100) / 100);
}

/** Keeps the box to an amount: digits and one decimal point with two places. */
function sanitizeAmountInput(raw: string): string {
  const digits = raw.replace(/[,\s]/g, "").replace(/[^\d.]/g, "");
  const dot = digits.indexOf(".");
  if (dot < 0) {
    return digits;
  }
  return `${digits.slice(0, dot + 1)}${digits
    .slice(dot + 1)
    .replace(/\./g, "")
    .slice(0, 2)}`;
}

function parseAmount(raw: string): number | null {
  const value = Number(sanitizeAmountInput(raw));
  return raw.trim() !== "" && Number.isFinite(value) && value > 0 ? value : null;
}

function renderCurrencyPicker(props: SpendingCardProps, display: SpendingDisplay) {
  const codes = Object.keys(display.rates);
  if (codes.length < 2) {
    return nothing;
  }
  const options = codes
    .map((code) => ({ code, name: currencyName(code, display.locale) }))
    .toSorted((a, b) => a.name.localeCompare(b.name));
  return html`
    <label class="qs-spending__currency">
      <span class="qs-spending__currency-label">Currency</span>
      <select
        aria-label="Currency to show spending in"
        ?disabled=${props.save === "saving"}
        @change=${(event: Event) =>
          props.onCurrencyChange((event.target as HTMLSelectElement).value)}
      >
        ${options.map(
          (option) =>
            html`<option value=${option.code} ?selected=${option.code === display.currency}>
              ${currencySymbol(option.code, display.locale)} ${option.name}
            </option>`,
        )}
      </select>
    </label>
  `;
}

function renderSummary(props: SpendingCardProps): TemplateResult {
  const status = props.status;
  if (!status) {
    if (props.load === "error") {
      return html`
        <div class="qs-spending__problem" role="alert">
          <span>Couldn't load your spending.</span>
          <button type="button" class="qs-spending__retry" @click=${props.onRetry}>
            Try again
          </button>
        </div>
      `;
    }
    return html`
      <div class="qs-spending__figure" aria-busy="true" aria-label="Loading spending">
        <span class="skeleton qs-spending__amount-skeleton"></span>
        <span class="skeleton qs-spending__caption-skeleton"></span>
      </div>
    `;
  }
  if (status.costReporting.state === "unpriced-model") {
    return html`
      <div class="qs-spending__uncounted">
        <span class="qs-spending__uncounted-icon" aria-hidden="true">${icons.info}</span>
        <div>
          <p class="qs-spending__uncounted-title">
            Spending can't be counted for ${status.costReporting.model}
          </p>
          <p class="qs-spending__uncounted-text">
            Daisy doesn't know what this model costs, so it can't add up spending or stop at a
            limit. This is usual for self-hosted or custom AI servers.
          </p>
        </div>
      </div>
    `;
  }
  const { display } = status;
  const spent = status.spentUsd * display.usdRate;
  const limit = display.monthlyLimit;
  const usedPercent =
    limit != null && limit > 0
      ? Math.min(100, Math.max(0, Math.round((spent / limit) * 100)))
      : null;
  const overLimit = status.exceeded;
  const nearLimit = !overLimit && status.nearLimit;
  return html`
    <div class="qs-spending__figure">
      <span class="qs-spending__amount" data-qs-spent
        >${formatMoney(spent, display.currency, display.locale)}</span
      >
      <span class="qs-spending__caption">spent this month, paid to your AI provider</span>
      ${display.currency === "USD" || status.spentUsd <= 0
        ? nothing
        : html`<span class="qs-spending__secondary"
            >≈ ${formatDollars(status.spentUsd)} · your provider bills in US dollars</span
          >`}
    </div>
    ${display.source === "fallback" && display.wantedCurrency
      ? html`<p class="qs-spending__note">
          Showing US dollars until today's ${currencyName(display.wantedCurrency, display.locale)}
          rate can be fetched.
        </p>`
      : nothing}
    ${status.costReporting.state === "partial"
      ? html`<p class="qs-spending__note">
          Some replies this month used a model with no known price, so the real total may be higher.
        </p>`
      : nothing}
    ${usedPercent != null && limit != null
      ? html`
          <div
            class="qs-spending__meter ${overLimit
              ? "qs-spending__meter--over"
              : nearLimit
                ? "qs-spending__meter--near"
                : ""}"
            role="meter"
            aria-label="Share of your monthly limit used"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow=${usedPercent}
          >
            <span class="qs-spending__meter-fill" style="width: ${usedPercent}%"></span>
          </div>
          <span class="qs-spending__meter-label">
            ${usedPercent}% of your ${formatMoney(limit, display.currency, display.locale)} monthly
            limit
          </span>
        `
      : nothing}
    ${overLimit
      ? html`<p class="qs-spending__notice qs-spending__notice--stop">
          Daisy has stopped making paid requests until you raise the limit or next month starts.
        </p>`
      : nearLimit
        ? html`<p class="qs-spending__notice">
            Close to your limit. Follow-up suggestions are paused to save what is left.
          </p>`
        : nothing}
  `;
}

function renderSaveState(save: SpendingSaveState) {
  if (save === "saving") {
    return html`<span class="qs-spending__save">Saving…</span>`;
  }
  if (save === "saved") {
    return html`<span class="qs-spending__save qs-spending__save--done"
      ><span aria-hidden="true">${icons.check}</span>Saved</span
    >`;
  }
  if (save === "error") {
    return html`<span class="qs-spending__save qs-spending__save--error">Couldn't save</span>`;
  }
  return nothing;
}

function renderControl(props: SpendingCardProps): TemplateResult {
  const status = props.status;
  const display = status?.display;
  const uncounted = status?.costReporting.state === "unpriced-model";
  const locale = display?.locale ?? "en-US";
  const currency = display?.currency ?? "USD";
  const current = display?.monthlyLimit ?? null;
  const disabled = !status || uncounted || props.save === "saving";
  const commit = (input: HTMLInputElement) => {
    const amount = parseAmount(input.value);
    input.value = limitInputValue(amount);
    if (amount !== current) {
      props.onLimitChange(amount);
    }
  };
  return html`
    <div class="qs-spending__control">
      <div class="qs-spending__label-row">
        <label class="qs-spending__label" for="qs-spending-limit">Monthly limit</label>
        <span aria-live="polite">${renderSaveState(props.save)}</span>
      </div>
      <span class="qs-spending__input ${disabled ? "is-disabled" : ""}">
        ${display
          ? html`<span class="qs-spending__affix" aria-hidden="true"
              >${currencySymbol(currency, locale)}</span
            >`
          : nothing}
        <input
          id="qs-spending-limit"
          type="text"
          inputmode="decimal"
          autocomplete="off"
          spellcheck="false"
          data-qs-spending-limit
          .value=${limitInputValue(current)}
          placeholder="No limit"
          aria-label=${`Monthly spending limit in ${currencyName(currency, locale)}`}
          ?disabled=${disabled}
          @input=${(event: Event) => {
            const input = event.target as HTMLInputElement;
            const clean = sanitizeAmountInput(input.value);
            if (clean !== input.value) {
              input.value = clean;
            }
          }}
          @keydown=${(event: KeyboardEvent) => {
            if (event.key === "Enter") {
              event.preventDefault();
              (event.target as HTMLInputElement).blur();
            }
          }}
          @change=${(event: Event) => commit(event.target as HTMLInputElement)}
        />
        <span class="qs-spending__affix">per month</span>
      </span>
      <p class="qs-spending__hint">
        ${uncounted
          ? "A limit can't take effect until Daisy can count spending."
          : "Leave it empty for no limit. Daisy warns you near the limit and stops paid requests once it's reached. The count restarts on the 1st of each month."}
      </p>
      ${display && display.currency !== "USD" && display.rateDate && !uncounted
        ? html`<p class="qs-spending__hint">
            Converted at ${formatMoney(display.usdRate, display.currency, locale)} per US$1, the
            rate on ${formatRateDate(display.rateDate, locale)}.
          </p>`
        : nothing}
    </div>
  `;
}

export function renderSpendingCard(props: SpendingCardProps): TemplateResult | typeof nothing {
  if (props.load === "unsupported") {
    return nothing;
  }
  const display = props.status?.display;
  return html`
    <div class="qs-card qs-card--spending" data-qs-spending>
      <div class="qs-card__header">
        <div class="qs-card__header-left">
          <span class="qs-card__icon">${icons.activity}</span>
          <h3 class="qs-card__title">Spending</h3>
        </div>
        ${display && props.status?.costReporting.state !== "unpriced-model"
          ? renderCurrencyPicker(props, display)
          : nothing}
      </div>
      <div class="qs-card__body qs-spending">
        <div class="qs-spending__summary">${renderSummary(props)}</div>
        ${renderControl(props)}
      </div>
    </div>
  `;
}
