import { describe, expect, it, vi } from "vitest";
import type { GatewayBrowserClient } from "../gateway.ts";
import { probeCustomProvider, saveCustomProvider } from "./models.ts";

type Call = { method: string; params: unknown };

function createClient(responses: Record<string, unknown>, calls: Call[] = []) {
  const client = {
    request: vi.fn(async (method: string, params: unknown) => {
      calls.push({ method, params });
      if (method in responses) {
        const value = responses[method];
        if (value instanceof Error) {
          throw value;
        }
        return value;
      }
      return {};
    }),
  } as unknown as GatewayBrowserClient;
  return { client, calls };
}

describe("probeCustomProvider", () => {
  it("returns the gateway's answer", async () => {
    const { client, calls } = createClient({
      "models.probeProvider": {
        reachable: true,
        kind: "litellm",
        providerId: "litellm",
        label: "LiteLLM",
        baseUrl: "http://10.0.0.5:4000/v1",
        models: ["claude-sonnet-4-5", "gemini-2.5-flash"],
        authRejected: false,
      },
    });
    const result = await probeCustomProvider(client, {
      baseUrl: " http://10.0.0.5:4000 ",
      apiKey: " sk-1 ",
    });
    expect(calls[0]).toEqual({
      method: "models.probeProvider",
      params: { baseUrl: "http://10.0.0.5:4000", apiKey: "sk-1" },
    });
    expect(result.providerId).toBe("litellm");
    expect(result.models).toEqual(["claude-sonnet-4-5", "gemini-2.5-flash"]);
  });

  it("falls back to a generic custom server when the gateway lacks the method", async () => {
    const { client } = createClient({
      "models.probeProvider": new Error("unknown method"),
    });
    const result = await probeCustomProvider(client, { baseUrl: "http://box:8000/v1" });
    expect(result).toMatchObject({
      reachable: false,
      providerId: "custom",
      label: "Custom server",
      baseUrl: "http://box:8000/v1",
      models: [],
    });
  });
});

describe("saveCustomProvider", () => {
  it("saves under the recognised provider id with the typed model first and server models after", async () => {
    const { client, calls } = createClient({
      "config.get": { hash: "h1", config: {} },
      "config.patch": { ok: true },
    });
    await saveCustomProvider({ client, connected: true } as never, {
      providerId: "litellm",
      baseUrl: "http://10.0.0.5:4000/v1",
      apiKey: "sk-1",
      modelId: "claude-sonnet-4-5",
      extraModelIds: ["gemini-2.5-flash", "claude-sonnet-4-5", " "],
      modelNameSuffix: "LiteLLM",
    });
    const patchCall = calls.find((call) => call.method === "config.patch");
    expect(patchCall).toBeTruthy();
    const params = patchCall?.params as { raw: string; baseHash: string; replacePaths: string[] };
    expect(params.baseHash).toBe("h1");
    expect(params.replacePaths).toEqual(["models.providers.litellm.models"]);
    const patch = JSON.parse(params.raw) as {
      models: { providers: Record<string, Record<string, unknown>> };
    };
    const provider = patch.models.providers.litellm;
    expect(provider.baseUrl).toBe("http://10.0.0.5:4000/v1");
    expect(provider.apiKey).toBe("sk-1");
    expect(provider.api).toBe("openai-completions");
    expect(provider.models).toEqual([
      { id: "claude-sonnet-4-5", name: "claude-sonnet-4-5 (LiteLLM)" },
      { id: "gemini-2.5-flash", name: "gemini-2.5-flash (LiteLLM)" },
    ]);
  });

  it("keeps an existing api setting and only appends unknown models", async () => {
    const { client, calls } = createClient({
      "config.get": {
        hash: "h2",
        config: {
          models: {
            providers: {
              custom: {
                baseUrl: "http://box:8000/v1",
                api: "anthropic-messages",
                models: [{ id: "mistral", name: "mistral" }],
              },
            },
          },
        },
      },
      "config.patch": { ok: true },
    });
    await saveCustomProvider({ client, connected: true } as never, {
      providerId: "custom",
      baseUrl: "http://box:8000/v1",
      modelId: "mistral",
    });
    const params = calls.find((call) => call.method === "config.patch")?.params as {
      raw: string;
      replacePaths?: string[];
    };
    const patch = JSON.parse(params.raw) as {
      models: { providers: Record<string, Record<string, unknown>> };
    };
    expect(patch.models.providers.custom.api).toBeUndefined();
    expect(patch.models.providers.custom.models).toBeUndefined();
    expect(params.replacePaths).toBeUndefined();
  });
});
