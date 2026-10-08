// Spending is shown in the currency people actually use. Providers bill in
// dollars, so this only changes what they read, never what is enforced.
import { describe, expect, it } from "vitest";
import {
  detectSpendingCountry,
  formatMoney,
  formatSpendingLimit,
  resolveSpendingDisplay,
} from "./spending-currency.js";

const rates = { date: "2026-10-05", fetchedAtMs: 0, rates: { INR: 96.3, EUR: 0.9, GBP: 0.75 } };

describe("spending currency", () => {
  // Many PCs in India keep the default US region while the clock says Kolkata.
  // The clock is the better guide to where someone is.
  it("trusts the time zone over a default US region", () => {
    expect(detectSpendingCountry({ timeZone: "Asia/Calcutta", locale: "en-US" })).toBe("IN");
    expect(detectSpendingCountry({ timeZone: "Asia/Kolkata", locale: "en-US" })).toBe("IN");
  });

  it("falls back to the region when the time zone says nothing useful", () => {
    expect(detectSpendingCountry({ timeZone: "Etc/UTC", locale: "en-GB" })).toBe("GB");
    expect(detectSpendingCountry({ locale: "de-DE" })).toBe("DE");
  });

  it("shows rupees to someone in India, written the Indian way", () => {
    const display = resolveSpendingDisplay({
      rates,
      limitUsd: null,
      timeZone: "Asia/Calcutta",
      locale: "en-US",
    });
    expect(display).toMatchObject({ currency: "INR", source: "detected", usdRate: 96.3 });
    expect(display.locale).toBe("en-IN");
    expect(formatMoney(123456.5, display.currency, display.locale)).toBe("₹1,23,456.50");
  });

  it("uses the currency the user chose over where they are", () => {
    const display = resolveSpendingDisplay({
      cfg: { spending: { currency: "GBP" } } as never,
      rates,
      limitUsd: null,
      timeZone: "Asia/Calcutta",
    });
    expect(display).toMatchObject({ currency: "GBP", source: "chosen", usdRate: 0.75 });
  });

  it("shows dollars, and says which currency it wanted, until a rate is known", () => {
    const display = resolveSpendingDisplay({
      rates: null,
      limitUsd: 10,
      timeZone: "Asia/Calcutta",
    });
    expect(display).toMatchObject({
      currency: "USD",
      source: "fallback",
      wantedCurrency: "INR",
      usdRate: 1,
      monthlyLimit: 10,
    });
  });

  it("keeps the limit exactly as typed in the chosen currency", () => {
    const display = resolveSpendingDisplay({
      cfg: { spending: { currency: "INR", monthlyLimit: 1000, monthlyLimitUsd: 10.38 } } as never,
      rates,
      limitUsd: 10.38,
    });
    expect(display.monthlyLimit).toBe(1000);
  });

  it("converts a dollar limit for someone who never chose a currency", () => {
    const display = resolveSpendingDisplay({
      cfg: { spending: { monthlyLimitUsd: 10 } } as never,
      rates,
      limitUsd: 10,
      timeZone: "Asia/Kolkata",
    });
    expect(display.monthlyLimit).toBe(963);
  });

  it("offers every currency it has a rate for, dollars included", () => {
    const display = resolveSpendingDisplay({ rates, limitUsd: null, timeZone: "Europe/Paris" });
    expect(display.currency).toBe("EUR");
    expect(Object.keys(display.rates).toSorted()).toEqual(["EUR", "GBP", "INR", "USD"]);
  });

  it("writes the stop message's limit as the user set it", () => {
    expect(
      formatSpendingLimit({
        cfg: { spending: { currency: "INR", monthlyLimit: 1000 } } as never,
        limitUsd: 10.38,
        locale: "en-US",
      }),
    ).toBe("₹1,000.00");
    expect(formatSpendingLimit({ limitUsd: 20 })).toBe("$20.00");
  });
});
