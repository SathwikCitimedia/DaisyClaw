// The spending card shows a real number in the user's own currency, never a
// bare dash, and says so plainly when the number cannot be known.
import { render } from "lit";
import { describe, expect, it, vi } from "vitest";
import type { SpendingStatus } from "../controllers/spending.ts";
import { renderSpendingCard, type SpendingCardProps } from "./spending-card.ts";

function status(overrides: Partial<SpendingStatus> = {}): SpendingStatus {
  return {
    spentUsd: 3.4,
    limitUsd: null,
    exceeded: false,
    nearLimit: false,
    display: {
      currency: "INR",
      source: "detected",
      usdRate: 96.3,
      rateDate: "2026-10-05",
      locale: "en-IN",
      rates: { USD: 1, INR: 96.3, EUR: 0.9 },
      monthlyLimit: null,
    },
    costReporting: { state: "counted" },
    ...overrides,
  };
}

function mount(overrides: Partial<SpendingCardProps> = {}) {
  const props: SpendingCardProps = {
    status: status(),
    load: "idle",
    save: "idle",
    onLimitChange: vi.fn(),
    onCurrencyChange: vi.fn(),
    onRetry: vi.fn(),
    ...overrides,
  };
  const container = document.createElement("div");
  render(renderSpendingCard(props), container);
  return { container, props };
}

function limitInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>("[data-qs-spending-limit]");
  if (!input) {
    throw new Error("no limit box");
  }
  return input;
}

describe("spending card", () => {
  it("shows what was spent in the user's currency, with the dollars beside it", () => {
    const { container } = mount();
    expect(container.querySelector("[data-qs-spent]")?.textContent?.trim()).toBe("₹327.42");
    expect(container.textContent).toContain("≈ $3.40");
    expect(container.textContent).toContain("bills in US dollars");
  });

  it("shows a loading placeholder, not a dash, before the figure arrives", () => {
    const { container } = mount({ status: null, load: "loading" });
    expect(container.querySelector(".qs-spending__amount-skeleton")).not.toBeNull();
    expect(container.textContent).not.toContain("—");
  });

  it("says loading failed and offers to try again", () => {
    const { container, props } = mount({ status: null, load: "error" });
    expect(container.textContent).toContain("Couldn't load your spending");
    container.querySelector<HTMLButtonElement>(".qs-spending__retry")?.click();
    expect(props.onRetry).toHaveBeenCalled();
  });

  it("says plainly when the model's spending cannot be counted", () => {
    const { container } = mount({
      status: status({ costReporting: { state: "unpriced-model", model: "Claude Sonnet 4.5" } }),
    });
    expect(container.textContent).toContain("Spending can't be counted for Claude Sonnet 4.5");
    expect(container.querySelector("[data-qs-spent]")).toBeNull();
    expect(limitInput(container).disabled).toBe(true);
  });

  it("shows the limit in the user's currency and how much of it is gone", () => {
    const { container } = mount({
      status: status({
        limitUsd: 10.38,
        display: { ...status().display, monthlyLimit: 1000 },
      }),
    });
    expect(limitInput(container).value).toBe("1000");
    expect(container.textContent?.replace(/\s+/g, " ")).toContain(
      "33% of your ₹1,000.00 monthly limit",
    );
  });

  it("keeps the box to an amount and saves it when the user is done", () => {
    const { container, props } = mount();
    const input = limitInput(container);
    input.value = "1,50a0.555";
    input.dispatchEvent(new Event("input"));
    expect(input.value).toBe("1500.55");
    input.dispatchEvent(new Event("change"));
    expect(props.onLimitChange).toHaveBeenCalledWith(1500.55);
  });

  it("clears the limit when the box is emptied", () => {
    const { container, props } = mount({
      status: status({ limitUsd: 10, display: { ...status().display, monthlyLimit: 963 } }),
    });
    const input = limitInput(container);
    input.value = "";
    input.dispatchEvent(new Event("change"));
    expect(props.onLimitChange).toHaveBeenCalledWith(null);
  });

  it("offers the currencies it has rates for", () => {
    const { container, props } = mount();
    const select = container.querySelector<HTMLSelectElement>(".qs-spending__currency select");
    expect(select?.value).toBe("INR");
    expect(Array.from(select?.options ?? []).map((option) => option.value)).toEqual(
      expect.arrayContaining(["USD", "INR", "EUR"]),
    );
    if (select) {
      select.value = "EUR";
      select.dispatchEvent(new Event("change"));
    }
    expect(props.onCurrencyChange).toHaveBeenCalledWith("EUR");
  });

  it("confirms a saved limit", () => {
    const { container } = mount({ save: "saved" });
    expect(container.textContent).toContain("Saved");
  });

  it("stays hidden on an engine with no spending figure", () => {
    const { container } = mount({ status: null, load: "unsupported" });
    expect(container.querySelector("[data-qs-spending]")).toBeNull();
  });
});
