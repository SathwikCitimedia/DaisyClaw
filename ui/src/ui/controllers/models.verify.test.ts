// Covers how setup decides a provider works.
//
// The wizard used to test only the first model in our catalog and treat that
// one verdict as the truth about the whole provider. Accounts differ in which
// models they may call, so a user with a perfectly good key was told setup had
// failed. These tests pin the walk, and pin that a verdict about the key or the
// account stops it immediately rather than retrying models pointlessly.
import { describe, expect, it, vi } from "vitest";
import type { GatewayBrowserClient } from "../gateway.ts";
import type { PickedProviderModel } from "./model-pick.ts";
import { verifyProviderModelCandidates } from "./models.ts";

const CANDIDATES: PickedProviderModel[] = [
  { ref: "openai/gpt-5.4-pro", modelId: "gpt-5.4-pro", name: "GPT-5.4 Pro" },
  { ref: "openai/gpt-5.4", modelId: "gpt-5.4", name: "GPT-5.4" },
  { ref: "openai/gpt-5.4-mini", modelId: "gpt-5.4-mini", name: "GPT-5.4 mini" },
];

function clientAnswering(byModel: Record<string, { ok: boolean; reason: string }>) {
  const request = vi.fn(async (_method: string, params?: unknown) => {
    const modelId = (params as { modelId?: string } | undefined)?.modelId ?? "(default)";
    const answer = byModel[modelId] ?? { ok: false, reason: "unknown" };
    return {
      ok: answer.ok,
      reason: answer.reason,
      provider: "openai",
      model: modelId,
      message: `${modelId}: ${answer.reason}`,
    };
  });
  return { client: { request } as unknown as GatewayBrowserClient, request };
}

describe("verifyProviderModelCandidates", () => {
  it("moves past a model the account cannot use and reports the one that works", async () => {
    const { client, request } = clientAnswering({
      "gpt-5.4-pro": { ok: false, reason: "model_not_found" },
      "gpt-5.4": { ok: true, reason: "ok" },
    });
    const result = await verifyProviderModelCandidates({
      client,
      providerId: "openai",
      candidates: CANDIDATES,
    });
    expect(result.model?.modelId).toBe("gpt-5.4");
    expect(result.verdict?.ok).toBe(true);
    expect(result.attempted).toHaveLength(2);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("stops at a rejected key, which no other model would fix", async () => {
    const { client, request } = clientAnswering({
      "gpt-5.4-pro": { ok: false, reason: "invalid_key" },
    });
    const result = await verifyProviderModelCandidates({
      client,
      providerId: "openai",
      candidates: CANDIDATES,
    });
    expect(result.verdict?.reason).toBe("invalid_key");
    expect(result.model).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("treats a model Daisy does not know as worth trying the next one", async () => {
    const { client } = clientAnswering({
      "gpt-5.4-pro": { ok: false, reason: "unknown_model" },
      "gpt-5.4": { ok: false, reason: "unknown_model" },
      "gpt-5.4-mini": { ok: true, reason: "ok" },
    });
    const result = await verifyProviderModelCandidates({
      client,
      providerId: "openai",
      candidates: CANDIDATES,
    });
    expect(result.model?.modelId).toBe("gpt-5.4-mini");
  });

  it("gives up after a bounded number of attempts", async () => {
    const { client, request } = clientAnswering({});
    const many = Array.from({ length: 12 }, (_, index) => ({
      ref: `openai/m${index}`,
      modelId: `m${index}`,
      name: `M${index}`,
    }));
    const result = await verifyProviderModelCandidates({
      client,
      providerId: "openai",
      candidates: many,
      maxAttempts: 3,
    });
    // "unknown" is not a model-specific reason, so the walk stops at the first.
    expect(result.model).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("falls back to the provider's own default when the catalog is empty", async () => {
    const { client, request } = clientAnswering({ "(default)": { ok: true, reason: "ok" } });
    const result = await verifyProviderModelCandidates({
      client,
      providerId: "openai",
      candidates: [],
    });
    expect(result.verdict?.ok).toBe(true);
    expect(result.model).toBeNull();
    expect(request).toHaveBeenCalledTimes(1);
    expect((request.mock.calls[0]?.[1] as { modelId?: string })?.modelId).toBeUndefined();
  });
});
