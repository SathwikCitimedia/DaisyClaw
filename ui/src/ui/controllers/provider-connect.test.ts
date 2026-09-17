import { describe, expect, it, vi } from "vitest";
import type { GatewayBrowserClient } from "../gateway.ts";
import { connectApiKeyProvider } from "./provider-connect.ts";

type Call = { method: string; params: Record<string, unknown> };

/**
 * A gateway stand-in that answers the five calls this path makes: config.get,
 * config.patch, models.list and models.testProvider.
 */
function fakeGateway(opts: {
  catalog: Array<{ id: string; provider: string; name?: string }>;
  existingDefault?: string;
  existingProviders?: string[];
  testVerdicts?: Record<string, { ok: boolean; reason: string; message: string }>;
}) {
  const calls: Call[] = [];
  const request = vi.fn(async (method: string, params: Record<string, unknown> = {}) => {
    calls.push({ method, params });
    switch (method) {
      case "config.get":
        return {
          config: {
            ...(opts.existingDefault
              ? { agents: { defaults: { model: opts.existingDefault } } }
              : {}),
            models: {
              providers: Object.fromEntries((opts.existingProviders ?? []).map((id) => [id, {}])),
            },
          },
          hash: "hash-1",
        };
      case "config.patch":
        return { ok: true, config: {}, hash: "hash-2" };
      case "models.list":
        return { models: opts.catalog };
      case "models.testProvider": {
        const modelId = String(params.modelId ?? "");
        return (
          opts.testVerdicts?.[modelId] ?? {
            ok: false,
            reason: "invalid_key",
            message: "rejected",
            provider: params.providerId,
            model: modelId,
          }
        );
      }
      default:
        throw new Error(`unexpected ${method}`);
    }
  });
  const client = { request } as unknown as GatewayBrowserClient;
  const patches = () =>
    calls
      .filter((c) => c.method === "config.patch")
      .map((c) => JSON.parse(String(c.params.raw)) as Record<string, unknown>);
  return { client, calls, patches };
}

const groqCatalog = [
  { id: "llama-3.3-70b-versatile", provider: "groq", name: "Llama 3.3 70B" },
  { id: "llama-3.1-8b-instant", provider: "groq", name: "Llama 3.1 8B" },
];

describe("connectApiKeyProvider", () => {
  // Sept 16: a Google-only user saved a valid key, the list came back empty, no
  // default was chosen, and chat fell back to the engine's OpenAI placeholder.
  it("selects one of the provider's own models as default before any test runs", async () => {
    const gw = fakeGateway({ catalog: groqCatalog });

    const result = await connectApiKeyProvider(
      { client: gw.client, connected: true },
      { providerId: "groq", apiKey: "gsk_x", setDefault: "always", listRetryDelayMs: 0 },
    );

    expect(result.defaultBeforeTest).toBe("groq/llama-3.3-70b-versatile");
    const defaults = gw.patches().filter((p) => "agents" in p);
    expect(defaults.length).toBeGreaterThan(0);
    expect((defaults[0].agents as { defaults: { model: unknown } }).defaults.model).toBe(
      "groq/llama-3.3-70b-versatile",
    );
    // The key was saved first.
    expect(gw.patches()[0]).toEqual({ models: { providers: { groq: { apiKey: "gsk_x" } } } });
  });

  it("keeps the provider's model as default even when the test fails", async () => {
    const gw = fakeGateway({ catalog: groqCatalog });

    const result = await connectApiKeyProvider(
      { client: gw.client, connected: true },
      { providerId: "groq", apiKey: "gsk_x", setDefault: "always", listRetryDelayMs: 0 },
    );

    expect(result.verified.verdict?.reason).toBe("invalid_key");
    expect(result.defaultBeforeTest).toBe("groq/llama-3.3-70b-versatile");
  });

  it("switches the default to the model that actually answered", async () => {
    const gw = fakeGateway({
      catalog: groqCatalog,
      testVerdicts: {
        "llama-3.3-70b-versatile": { ok: false, reason: "model_not_found", message: "no" },
        "llama-3.1-8b-instant": { ok: true, reason: "ok", message: "yes" },
      },
    });

    const result = await connectApiKeyProvider(
      { client: gw.client, connected: true },
      { providerId: "groq", apiKey: "gsk_x", setDefault: "always", listRetryDelayMs: 0 },
    );

    expect(result.verified.model?.ref).toBe("groq/llama-3.1-8b-instant");
    const defaults = gw
      .patches()
      .filter((p) => "agents" in p)
      .map((p) => (p.agents as { defaults: { model: unknown } }).defaults.model);
    expect(defaults.at(-1)).toBe("groq/llama-3.1-8b-instant");
  });

  it("in Settings, does not steal the default from a provider that already works", async () => {
    const gw = fakeGateway({
      catalog: groqCatalog,
      existingDefault: "anthropic/claude-fable-5",
      existingProviders: ["anthropic"],
    });

    const result = await connectApiKeyProvider(
      { client: gw.client, connected: true },
      { providerId: "groq", apiKey: "gsk_x", setDefault: "if-missing", listRetryDelayMs: 0 },
    );

    expect(result.defaultBeforeTest).toBeNull();
    expect(gw.patches().some((p) => "agents" in p)).toBe(false);
  });

  it("in Settings, replaces a default that points at a provider with no key", async () => {
    // The engine's built-in placeholder (openai/gpt-5.5) with no OpenAI key.
    const gw = fakeGateway({
      catalog: groqCatalog,
      existingDefault: "openai/gpt-5.5",
      existingProviders: [],
    });

    const result = await connectApiKeyProvider(
      { client: gw.client, connected: true },
      { providerId: "groq", apiKey: "gsk_x", setDefault: "if-missing", listRetryDelayMs: 0 },
    );

    expect(result.defaultBeforeTest).toBe("groq/llama-3.3-70b-versatile");
  });

  it("retries the list once when it arrives empty", async () => {
    let listCalls = 0;
    const gw = fakeGateway({ catalog: groqCatalog });
    const original = gw.client.request.bind(gw.client);
    (gw.client as { request: unknown }).request = vi.fn(
      async (method: string, params?: Record<string, unknown>) => {
        if (method === "models.list") {
          listCalls += 1;
          if (listCalls === 1) {
            return { models: [] };
          }
        }
        return original(method, params ?? {});
      },
    );

    const result = await connectApiKeyProvider(
      { client: gw.client, connected: true },
      { providerId: "groq", apiKey: "gsk_x", setDefault: "always", listRetryDelayMs: 0 },
    );

    expect(listCalls).toBe(2);
    expect(result.candidates).toHaveLength(2);
  });
});
