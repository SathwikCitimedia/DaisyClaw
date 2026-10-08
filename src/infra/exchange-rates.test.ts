// Spending is shown in the user's currency with the day's rate. The card must
// never wait on the network once it has rates, and being offline only means
// showing the last rate Daisy saw.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getUsdExchangeRates, resetExchangeRatesForTest } from "./exchange-rates.js";

const DAY_MS = 24 * 60 * 60 * 1000;
let dir: string;
let cachePath: string;

function ratesResponse(rates: Record<string, number>, date = "2026-10-05") {
  return new Response(JSON.stringify({ amount: 1, base: "USD", date, rates }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function writeCachedRates(rates: Record<string, number>, date: string) {
  fs.writeFileSync(cachePath, JSON.stringify({ date, rates, fetchedAtMs: 0 }));
}

beforeEach(() => {
  resetExchangeRatesForTest();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "daisyclaw-rates-"));
  cachePath = path.join(dir, "exchange-rates.json");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("exchange rates", () => {
  it("fetches today's rates the first time and keeps a copy", async () => {
    const fetchFn = vi.fn(async () => ratesResponse({ INR: 96.3, EUR: 0.89 }));
    const rates = await getUsdExchangeRates({ cachePath, fetchFn, nowMs: 1_000 });
    expect(rates?.rates.INR).toBe(96.3);
    expect(rates?.date).toBe("2026-10-05");
    expect(JSON.parse(fs.readFileSync(cachePath, "utf8")).rates.INR).toBe(96.3);
  });

  it("reuses recent rates without going to the network", async () => {
    const fetchFn = vi.fn(async () => ratesResponse({ INR: 96.3 }));
    await getUsdExchangeRates({ cachePath, fetchFn, nowMs: 1_000 });
    await getUsdExchangeRates({ cachePath, fetchFn, nowMs: 61_000 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("answers with older rates at once and refreshes behind them", async () => {
    writeCachedRates({ INR: 95 }, "2026-10-04");
    const fetchFn = vi.fn(async () => ratesResponse({ INR: 96.3 }));
    const first = await getUsdExchangeRates({ cachePath, fetchFn, nowMs: DAY_MS });
    expect(first?.rates.INR).toBe(95);
    await vi.waitFor(async () => {
      const next = await getUsdExchangeRates({ cachePath, fetchFn, nowMs: DAY_MS });
      expect(next?.rates.INR).toBe(96.3);
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("keeps the last rates when offline", async () => {
    writeCachedRates({ INR: 94 }, "2026-10-01");
    const fetchFn = vi.fn(async () => {
      throw new Error("offline");
    });
    const rates = await getUsdExchangeRates({ cachePath, fetchFn, nowMs: 10 * DAY_MS });
    expect(rates?.rates.INR).toBe(94);
  });

  it("has nothing to offer when rates were never reachable", async () => {
    const fetchFn = vi.fn(async () => new Response("busy", { status: 503 }));
    expect(await getUsdExchangeRates({ cachePath, fetchFn, nowMs: 1_000 })).toBeNull();
  });

  it("ignores a reply that is not a set of dollar rates", async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(JSON.stringify({ base: "EUR", date: "2026-10-05", rates: { INR: 105 } }), {
          status: 200,
        }),
    );
    expect(await getUsdExchangeRates({ cachePath, fetchFn, nowMs: 1_000 })).toBeNull();
  });
});
