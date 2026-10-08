// Which currency spending is shown in, and how to write an amount in it.
//
// Providers bill in US dollars and the limit is enforced in dollars, so the
// currency only changes what people read. It is the one the user chose, or
// else the one where they are.
//
// "Where they are" leans on the time zone before the region setting: many PCs
// in India, for one, keep Windows' default "United States" region and US number
// format while their clock says Asia/Kolkata, and a rupee user shown dollars
// would rightly think the card was not meant for them.
import type { DaisyClawConfig } from "../config/types.daisyclaw.js";
import type { UsdExchangeRates } from "./exchange-rates.js";

const EURO_COUNTRIES = [
  "AT",
  "BE",
  "BG",
  "CY",
  "DE",
  "EE",
  "ES",
  "FI",
  "FR",
  "GR",
  "HR",
  "IE",
  "IT",
  "LT",
  "LU",
  "LV",
  "MT",
  "NL",
  "PT",
  "SI",
  "SK",
];

const CURRENCY_BY_COUNTRY: Record<string, string> = {
  ...Object.fromEntries(EURO_COUNTRIES.map((country) => [country, "EUR"])),
  AU: "AUD",
  BR: "BRL",
  CA: "CAD",
  CH: "CHF",
  CN: "CNY",
  CZ: "CZK",
  DK: "DKK",
  GB: "GBP",
  HK: "HKD",
  HU: "HUF",
  ID: "IDR",
  IL: "ILS",
  IN: "INR",
  IS: "ISK",
  JP: "JPY",
  KR: "KRW",
  MX: "MXN",
  MY: "MYR",
  NO: "NOK",
  NZ: "NZD",
  PH: "PHP",
  PL: "PLN",
  RO: "RON",
  SE: "SEK",
  SG: "SGD",
  TH: "THB",
  TR: "TRY",
  US: "USD",
  ZA: "ZAR",
};

/** The country whose writing conventions a currency is usually read in. */
const HOME_COUNTRY_BY_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(CURRENCY_BY_COUNTRY)
      .filter(([, currency]) => currency !== "EUR")
      .map(([country, currency]) => [currency, country]),
  ),
  EUR: "IE",
};

const COUNTRY_BY_TIME_ZONE: Record<string, string> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "America/Detroit": "US",
  "Pacific/Honolulu": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/St_Johns": "CA",
  "America/Regina": "CA",
  "America/Mexico_City": "MX",
  "America/Monterrey": "MX",
  "America/Tijuana": "MX",
  "America/Cancun": "MX",
  "America/Sao_Paulo": "BR",
  "America/Manaus": "BR",
  "America/Fortaleza": "BR",
  "America/Recife": "BR",
  "America/Bahia": "BR",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Berlin": "DE",
  "Europe/Paris": "FR",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Vienna": "AT",
  "Europe/Lisbon": "PT",
  "Europe/Helsinki": "FI",
  "Europe/Athens": "GR",
  "Europe/Luxembourg": "LU",
  "Europe/Bratislava": "SK",
  "Europe/Ljubljana": "SI",
  "Europe/Tallinn": "EE",
  "Europe/Riga": "LV",
  "Europe/Vilnius": "LT",
  "Europe/Malta": "MT",
  "Asia/Nicosia": "CY",
  "Europe/Zagreb": "HR",
  "Europe/Sofia": "BG",
  "Europe/Zurich": "CH",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Budapest": "HU",
  "Europe/Bucharest": "RO",
  "Europe/Istanbul": "TR",
  "Atlantic/Reykjavik": "IS",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK",
  "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Bangkok": "TH",
  "Asia/Jakarta": "ID",
  "Asia/Makassar": "ID",
  "Asia/Jayapura": "ID",
  "Asia/Manila": "PH",
  "Asia/Jerusalem": "IL",
  "Asia/Tel_Aviv": "IL",
  "Pacific/Auckland": "NZ",
  "Africa/Johannesburg": "ZA",
};

function countryFromTimeZone(timeZone: string | undefined): string | null {
  if (!timeZone) {
    return null;
  }
  if (timeZone.startsWith("Australia/")) {
    return "AU";
  }
  return COUNTRY_BY_TIME_ZONE[timeZone] ?? null;
}

function countryFromLocale(locale: string | undefined): string | null {
  if (!locale) {
    return null;
  }
  try {
    return new Intl.Locale(locale).maximize().region ?? null;
  } catch {
    return null;
  }
}

function languageFromLocale(locale: string | undefined): string {
  if (!locale) {
    return "en";
  }
  try {
    return new Intl.Locale(locale).language || "en";
  } catch {
    return "en";
  }
}

/** Where the viewer most likely is: their clock first, their region setting second. */
export function detectSpendingCountry(params: {
  timeZone?: string;
  locale?: string;
}): string | null {
  return countryFromTimeZone(params.timeZone) ?? countryFromLocale(params.locale);
}

/** The locale to write `currency` amounts in for this viewer, e.g. en-IN for rupees. */
export function resolveMoneyLocale(params: {
  currency: string;
  locale?: string;
  country?: string | null;
}): string {
  const country =
    params.country && CURRENCY_BY_COUNTRY[params.country] === params.currency
      ? params.country
      : HOME_COUNTRY_BY_CURRENCY[params.currency];
  const fallback = params.locale && isSupportedLocale(params.locale) ? params.locale : "en-US";
  if (!country) {
    return fallback;
  }
  const candidate = `${languageFromLocale(params.locale)}-${country}`;
  return isSupportedLocale(candidate) ? candidate : fallback;
}

function isSupportedLocale(locale: string): boolean {
  try {
    return Intl.NumberFormat.supportedLocalesOf([locale]).length > 0;
  } catch {
    return false;
  }
}

/** An amount written the way its readers expect, e.g. ₹1,23,456.50 or €12.40. */
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

export type SpendingDisplay = {
  /** ISO 4217 code amounts are shown in. */
  currency: string;
  /**
   * chosen: the user picked it. detected: picked from where they are.
   * fallback: dollars, because the rate for `wantedCurrency` is not known yet.
   */
  source: "chosen" | "detected" | "fallback";
  /** The currency that could not be shown, when `source` is fallback. */
  wantedCurrency?: string;
  /** Units of `currency` per US dollar; 1 for dollars. */
  usdRate: number;
  /** The day the rate was published, or null for dollars. */
  rateDate: string | null;
  /** Locale amounts are written in, e.g. "en-IN". */
  locale: string;
  /** Units per US dollar for every currency that can be chosen, dollars included. */
  rates: Record<string, number>;
  /** The limit in `currency`, as typed when it was set in this currency. */
  monthlyLimit: number | null;
};

function readChosenCurrency(cfg: DaisyClawConfig | undefined): string | null {
  const raw = cfg?.spending?.currency;
  return typeof raw === "string" && /^[A-Z]{3}$/.test(raw) ? raw : null;
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** How this viewer should see spending, given the rates Daisy has. */
export function resolveSpendingDisplay(params: {
  cfg?: DaisyClawConfig;
  rates: UsdExchangeRates | null;
  limitUsd: number | null;
  timeZone?: string;
  locale?: string;
}): SpendingDisplay {
  const rates: Record<string, number> = { USD: 1, ...params.rates?.rates };
  const chosen = readChosenCurrency(params.cfg);
  const country = detectSpendingCountry(params);
  const detected = country ? (CURRENCY_BY_COUNTRY[country] ?? null) : null;
  const wanted = chosen ?? detected ?? "USD";
  const usable = rates[wanted] !== undefined;
  const currency = usable ? wanted : "USD";
  const source = !usable ? "fallback" : chosen ? "chosen" : "detected";
  const usdRate = rates[currency] ?? 1;
  const typedLimit = params.cfg?.spending?.monthlyLimit;
  const monthlyLimit =
    params.limitUsd == null
      ? null
      : chosen === currency && typeof typedLimit === "number" && typedLimit > 0
        ? typedLimit
        : roundMoney(params.limitUsd * usdRate);
  return {
    currency,
    source,
    ...(source === "fallback" ? { wantedCurrency: wanted } : {}),
    usdRate,
    rateDate: currency === "USD" ? null : (params.rates?.date ?? null),
    locale: resolveMoneyLocale({ currency, locale: params.locale, country }),
    rates,
    monthlyLimit,
  };
}

/**
 * The limit as the user set it, for messages written without rates to hand:
 * their own number in their own currency when they set one, dollars otherwise.
 */
export function formatSpendingLimit(params: {
  cfg?: DaisyClawConfig;
  limitUsd: number;
  locale?: string;
}): string {
  const chosen = readChosenCurrency(params.cfg);
  const typed = params.cfg?.spending?.monthlyLimit;
  if (chosen && typeof typed === "number" && typed > 0) {
    return formatMoney(
      typed,
      chosen,
      resolveMoneyLocale({ currency: chosen, locale: params.locale }),
    );
  }
  return formatMoney(params.limitUsd, "USD", "en-US");
}
