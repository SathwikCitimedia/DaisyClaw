// Control UI tests cover Model Studio config mutations.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayBrowserClient } from "../gateway.ts";
import {
  resolveDefaultModelSelection,
  saveCustomProvider,
  saveProviderApiKey,
  setDefaultModel,
  setModelFallbacks,
} from "./models.ts";

function createState(config: Record<string, unknown>) {
  const request = vi.fn(async (method: string) => {
    if (method === "config.get") {
      return { hash: "hash-1", config };
    }
    if (method === "config.patch") {
      return {};
    }
    throw new Error(`unexpected method: ${method}`);
  });
  return {
    state: { client: { request } as unknown as GatewayBrowserClient, connected: true },
    request,
  };
}

describe("model studio mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores an API key for a bundled provider", async () => {
    const { state, request } = createState({});

    await saveProviderApiKey(state, "anthropic", " sk-ant-test ");

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({ models: { providers: { anthropic: { apiKey: "sk-ant-test" } } } }),
      baseHash: "hash-1",
    });
  });

  it("rejects an empty API key before touching config", async () => {
    const { state, request } = createState({});

    await expect(saveProviderApiKey(state, "openai", "   ")).rejects.toThrow(/required/);
    expect(request).not.toHaveBeenCalledWith("config.patch", expect.anything());
  });

  it("registers a custom provider with base URL and model list", async () => {
    const { state, request } = createState({});

    await saveCustomProvider(state, {
      providerId: "litellm",
      baseUrl: "http://10.21.66.8:4000/v1",
      apiKey: "sk-lite",
      modelId: "claude-sonnet-4-5",
    });

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({
        models: {
          providers: {
            litellm: {
              baseUrl: "http://10.21.66.8:4000/v1",
              apiKey: "sk-lite",
              models: [{ id: "claude-sonnet-4-5", name: "claude-sonnet-4-5" }],
            },
          },
        },
      }),
      baseHash: "hash-1",
      replacePaths: ["models.providers.litellm.models"],
    });
  });

  it("keeps existing custom-provider models and skips duplicates", async () => {
    const { state, request } = createState({
      models: {
        providers: {
          litellm: {
            baseUrl: "http://old",
            models: [{ id: "claude-sonnet-4-5", name: "Sonnet" }],
          },
        },
      },
    });

    await saveCustomProvider(state, {
      providerId: "litellm",
      baseUrl: "http://new",
      modelId: "claude-sonnet-4-5",
    });

    const patchCall = request.mock.calls.find(([method]) => method === "config.patch");
    expect(patchCall?.[1]).toEqual({
      raw: JSON.stringify({
        models: { providers: { litellm: { baseUrl: "http://new" } } },
      }),
      baseHash: "hash-1",
    });
  });

  it("sets the default model while preserving fallbacks", async () => {
    const { state, request } = createState({
      agents: { defaults: { model: { primary: "a/one", fallbacks: ["b/two", "c/three"] } } },
    });

    await setDefaultModel(state, "b/two");

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({
        agents: { defaults: { model: { primary: "b/two", fallbacks: ["c/three"] } } },
      }),
      baseHash: "hash-1",
      replacePaths: ["agents.defaults.model"],
    });
  });

  it("writes a plain string when there are no fallbacks", async () => {
    const { state, request } = createState({
      agents: { defaults: { model: "a/one" } },
    });

    await setDefaultModel(state, "b/two");

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({ agents: { defaults: { model: "b/two" } } }),
      baseHash: "hash-1",
      replacePaths: ["agents.defaults.model"],
    });
  });

  it("replaces the fallback chain and drops the primary from it", async () => {
    const { state, request } = createState({
      agents: { defaults: { model: "a/one" } },
    });

    await setModelFallbacks(state, ["b/two", "a/one", "c/three"]);

    expect(request).toHaveBeenCalledWith("config.patch", {
      raw: JSON.stringify({
        agents: { defaults: { model: { primary: "a/one", fallbacks: ["b/two", "c/three"] } } },
      }),
      baseHash: "hash-1",
      replacePaths: ["agents.defaults.model"],
    });
  });

  it("refuses fallbacks when no default model exists", async () => {
    const { state } = createState({});

    await expect(setModelFallbacks(state, ["b/two"])).rejects.toThrow(/default model/);
  });

  it("resolves default selection from string and object forms", () => {
    expect(resolveDefaultModelSelection({ agents: { defaults: { model: "a/one" } } })).toEqual({
      primary: "a/one",
      fallbacks: [],
    });
    expect(
      resolveDefaultModelSelection({
        agents: { defaults: { model: { primary: "a/one", fallbacks: ["b/two"] } } },
      }),
    ).toEqual({ primary: "a/one", fallbacks: ["b/two"] });
    expect(resolveDefaultModelSelection(null)).toEqual({ primary: null, fallbacks: [] });
  });
});
