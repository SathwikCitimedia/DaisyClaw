// The spending card must not show a reassuring 0.00 that is not real. A model
// with no known price always adds up to zero, and a limit on it never triggers.
import { beforeEach, describe, expect, it, vi } from "vitest";

const evaluateSpending = vi.hoisted(() => vi.fn());
vi.mock("../infra/spending-limit.js", () => ({ evaluateSpending }));

import { buildSpendingStatusPayload, resolveSpendingCostReporting } from "./spending-status.js";

function configWithModel(cost: { input: number; output: number }) {
  return {
    agents: { defaults: { model: { primary: "acme/acme-large" } } },
    models: {
      providers: {
        acme: {
          baseUrl: "https://ai.acme.test/v1",
          api: "openai-completions",
          models: [
            {
              id: "acme-large",
              name: "Acme Large",
              cost: { ...cost, cacheRead: 0, cacheWrite: 0 },
            },
          ],
        },
      },
    },
  } as never;
}

beforeEach(() => {
  evaluateSpending.mockReset();
  evaluateSpending.mockResolvedValue({
    limitUsd: null,
    spentUsd: 0,
    remainingUsd: null,
    exceeded: false,
    nearLimit: false,
    periodStartMs: 0,
    unpricedReplies: 0,
  });
});

describe("spending card status", () => {
  it("says spending cannot be counted when the model has no known price", () => {
    expect(
      resolveSpendingCostReporting({
        cfg: configWithModel({ input: 0, output: 0 }),
        unpricedReplies: 0,
      }),
    ).toEqual({ state: "unpriced-model", model: "Acme Large" });
  });

  it("counts normally for a priced model", () => {
    expect(
      resolveSpendingCostReporting({
        cfg: configWithModel({ input: 3, output: 15 }),
        unpricedReplies: 0,
      }),
    ).toEqual({ state: "counted" });
  });

  it("warns that the total is low when some replies could not be priced", () => {
    expect(
      resolveSpendingCostReporting({
        cfg: configWithModel({ input: 3, output: 15 }),
        unpricedReplies: 4,
      }),
    ).toEqual({ state: "partial", unpricedReplies: 4 });
  });

  it("answers in the viewer's currency", async () => {
    const payload = await buildSpendingStatusPayload({
      cfg: configWithModel({ input: 3, output: 15 }),
      timeZone: "Asia/Kolkata",
      locale: "en-US",
      loadRates: async () => ({ date: "2026-10-05", fetchedAtMs: 0, rates: { INR: 96.3 } }),
    });
    expect(payload.display).toMatchObject({ currency: "INR", usdRate: 96.3, locale: "en-IN" });
    expect(payload.costReporting).toEqual({ state: "counted" });
  });

  it("still answers, in dollars, when rates cannot be loaded", async () => {
    const payload = await buildSpendingStatusPayload({
      cfg: configWithModel({ input: 3, output: 15 }),
      timeZone: "Asia/Kolkata",
      loadRates: async () => {
        throw new Error("offline");
      },
    });
    expect(payload.display).toMatchObject({ currency: "USD", source: "fallback" });
  });
});
