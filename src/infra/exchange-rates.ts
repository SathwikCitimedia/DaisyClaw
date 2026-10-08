// Today's US dollar exchange rates, for showing spending in the user's own
// currency. Providers bill in dollars; this only changes what people read.
//
// Rates come from the European Central Bank's daily reference rates, served by
// the Frankfurter API: no account, no key, and the request carries nothing
// about the user. They change once a working day, so a copy is kept on disk
// and reused, and being offline only means showing the last known rate.
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { fetchWithTimeout } from "../utils/fetch-timeout.js";
import { tryReadJson, writeTextAtomic } from "./json-files.js";

export type UsdExchangeRates = {
  /** The day the central bank published these rates, e.g. "2026-10-05". */
  date: string;
  /** Units of each currency that one US dollar buys, keyed by ISO 4217 code. */
  rates: Record<string, number>;
  fetchedAtMs: number;
};

const RATES_URL = "https://api.frankfurter.dev/v1/latest?base=USD";
const FETCH_TIMEOUT_MS = 6_000;
/** Rates are published once a working day; checking twice a day keeps them current. */
const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;
const CACHE_FILE = "exchange-rates.json";

let memory: UsdExchangeRates | null = null;
let inflight: Promise<UsdExchangeRates | null> | null = null;

/** Test seam: forget rates held in memory. */
export function resetExchangeRatesForTest(): void {
  memory = null;
  inflight = null;
}

function defaultCachePath(): string {
  return path.join(resolveStateDir(), "state", CACHE_FILE);
}

function parseRates(value: unknown, fetchedAtMs: number): UsdExchangeRates | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as { base?: unknown; date?: unknown; rates?: unknown };
  if (record.base !== undefined && record.base !== "USD") {
    return null;
  }
  if (typeof record.date !== "string" || !record.rates || typeof record.rates !== "object") {
    return null;
  }
  const rates: Record<string, number> = {};
  for (const [code, rate] of Object.entries(record.rates as Record<string, unknown>)) {
    if (/^[A-Z]{3}$/.test(code) && typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
      rates[code] = rate;
    }
  }
  if (Object.keys(rates).length === 0) {
    return null;
  }
  return { date: record.date, rates, fetchedAtMs };
}

async function readCachedRates(cachePath: string): Promise<UsdExchangeRates | null> {
  const cached = await tryReadJson<UsdExchangeRates>(cachePath);
  if (!cached || typeof cached.fetchedAtMs !== "number") {
    return null;
  }
  return parseRates(cached, cached.fetchedAtMs);
}

async function fetchRates(params: {
  cachePath: string;
  fetchFn?: typeof fetch;
  nowMs: number;
}): Promise<UsdExchangeRates | null> {
  try {
    const res = await fetchWithTimeout(RATES_URL, {}, FETCH_TIMEOUT_MS, params.fetchFn);
    if (!res.ok) {
      return null;
    }
    const parsed = parseRates(await res.json(), params.nowMs);
    if (!parsed) {
      return null;
    }
    memory = parsed;
    await writeTextAtomic(params.cachePath, JSON.stringify(parsed), { durable: false }).catch(
      () => undefined,
    );
    return parsed;
  } catch {
    return null;
  }
}

/**
 * The latest rates Daisy has. A recent copy is returned straight away; an old
 * one is returned too while a fresh one is fetched behind it, so the Settings
 * card never waits on the network once it has seen rates. Only the very first
 * look waits, briefly. Null means no rates have ever been reachable.
 */
export async function getUsdExchangeRates(params?: {
  cachePath?: string;
  fetchFn?: typeof fetch;
  nowMs?: number;
}): Promise<UsdExchangeRates | null> {
  const nowMs = params?.nowMs ?? Date.now();
  const cachePath = params?.cachePath ?? defaultCachePath();
  if (!memory) {
    memory = await readCachedRates(cachePath);
  }
  const refresh = () => {
    inflight ??= fetchRates({ cachePath, fetchFn: params?.fetchFn, nowMs }).finally(() => {
      inflight = null;
    });
    return inflight;
  };
  if (!memory) {
    return await refresh();
  }
  if (nowMs - memory.fetchedAtMs >= REFRESH_AFTER_MS) {
    void refresh();
  }
  return memory;
}
