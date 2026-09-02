// Control UI controller manages models gateway state.
import type { GatewayBrowserClient } from "../gateway.ts";
import type { ModelCatalogEntry } from "../types.ts";

const MODEL_CATALOG_CACHE_TTL_MS = 60_000;

type ModelCatalogCacheEntry = {
  expiresAt: number;
  models: ModelCatalogEntry[];
  inFlight?: Promise<ModelCatalogEntry[]>;
};

const modelCatalogCache = new WeakMap<GatewayBrowserClient, ModelCatalogCacheEntry>();

/**
 * Fetch the model catalog from the gateway.
 *
 * Accepts a {@link GatewayBrowserClient} (matching the existing ui/ controller
 * convention).  Returns an array of {@link ModelCatalogEntry}; on failure the
 * caller receives an empty array rather than throwing.
 */
export async function loadModels(client: GatewayBrowserClient): Promise<ModelCatalogEntry[]> {
  const cached = modelCatalogCache.get(client);
  const now = Date.now();
  if (cached?.models && cached.expiresAt > now) {
    return cached.models;
  }
  if (cached?.inFlight) {
    return cached.inFlight;
  }

  const inFlight = requestModels(client, cached?.models).finally(() => {
    const latest = modelCatalogCache.get(client);
    if (latest?.inFlight === inFlight) {
      delete latest.inFlight;
    }
  });
  modelCatalogCache.set(client, {
    expiresAt: cached?.expiresAt ?? 0,
    models: cached?.models ?? [],
    inFlight,
  });
  return inFlight;
}

export function applyModelCatalogResult(models: unknown): ModelCatalogEntry[] | null {
  if (!Array.isArray(models)) {
    return null;
  }
  return models as ModelCatalogEntry[];
}

async function requestModels(
  client: GatewayBrowserClient,
  fallback: ModelCatalogEntry[] | undefined,
): Promise<ModelCatalogEntry[]> {
  try {
    const result = await client.request<{ models: ModelCatalogEntry[] }>("models.list", {
      view: "configured",
    });
    const models = result?.models ?? [];
    modelCatalogCache.set(client, {
      expiresAt: Date.now() + MODEL_CATALOG_CACHE_TTL_MS,
      models,
    });
    return models;
  } catch {
    return fallback ?? [];
  }
}

/** Drop the cached catalog so the next loadModels() reflects a config change. */
export function invalidateModelCatalog(client: GatewayBrowserClient | null) {
  if (client) {
    modelCatalogCache.delete(client);
  }
}

type ModelsMutationState = {
  client: GatewayBrowserClient | null;
  connected: boolean;
};

/** Full "provider/model" ref for a catalog entry. */
export function modelCatalogRef(entry: ModelCatalogEntry): string {
  return entry.id.includes("/") ? entry.id : `${entry.provider}/${entry.id}`;
}

async function patchConfig(
  state: ModelsMutationState,
  build: (config: Record<string, unknown>) => {
    patch: Record<string, unknown>;
    replacePaths?: string[];
  } | null,
): Promise<void> {
  if (!state.client || !state.connected) {
    throw new Error("gateway not connected");
  }
  const snapshot = await state.client.request<{
    hash?: string;
    config?: Record<string, unknown>;
  }>("config.get", {});
  const result = build(snapshot?.config ?? {});
  if (!result) {
    return;
  }
  await state.client.request("config.patch", {
    raw: JSON.stringify(result.patch),
    baseHash: snapshot?.hash,
    ...(result.replacePaths?.length ? { replacePaths: result.replacePaths } : {}),
  });
}

/** Store an API key for a bundled provider (anthropic, openai, google, groq, …). */
export async function saveProviderApiKey(
  state: ModelsMutationState,
  providerId: string,
  apiKey: string,
): Promise<void> {
  const key = apiKey.trim();
  if (!key) {
    throw new Error("API key is required");
  }
  await patchConfig(state, () => ({
    patch: { models: { providers: { [providerId]: { apiKey: key } } } },
  }));
}

/** Register a custom OpenAI-compatible provider (LiteLLM, vLLM, local server…). */
export async function saveCustomProvider(
  state: ModelsMutationState,
  input: { providerId: string; baseUrl: string; apiKey?: string; modelId: string },
): Promise<void> {
  const providerId = input.providerId.trim().toLowerCase();
  const baseUrl = input.baseUrl.trim();
  const modelId = input.modelId.trim();
  if (!providerId || !baseUrl || !modelId) {
    throw new Error("server name, address, and model id are required");
  }
  const apiKey = input.apiKey?.trim();
  await patchConfig(state, (config) => {
    const providers =
      ((config.models as Record<string, unknown> | undefined)?.providers as
        | Record<string, unknown>
        | undefined) ?? {};
    const existing = (providers[providerId] ?? {}) as Record<string, unknown>;
    const existingModels = Array.isArray(existing.models)
      ? (existing.models as Array<{ id?: string }>)
      : [];
    const alreadyListed = existingModels.some((entry) => entry?.id === modelId);
    return {
      patch: {
        models: {
          providers: {
            [providerId]: {
              baseUrl,
              ...(apiKey ? { apiKey } : {}),
              ...(alreadyListed
                ? {}
                : { models: [...existingModels, { id: modelId, name: modelId }] }),
            },
          },
        },
      },
      // Arrays merge with explicit intent only; replace keeps the model list exact.
      ...(alreadyListed ? {} : { replacePaths: [`models.providers.${providerId}.models`] }),
    };
  });
}

function readDefaultModel(config: Record<string, unknown>): {
  primary: string | null;
  fallbacks: string[];
} {
  const model = (config.agents as Record<string, unknown> | undefined)?.defaults as
    | Record<string, unknown>
    | undefined;
  const raw = model?.model;
  if (typeof raw === "string" && raw.trim()) {
    return { primary: raw.trim(), fallbacks: [] };
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const entry = raw as { primary?: unknown; fallbacks?: unknown };
    return {
      primary: typeof entry.primary === "string" && entry.primary.trim() ? entry.primary : null,
      fallbacks: Array.isArray(entry.fallbacks)
        ? entry.fallbacks.filter((ref): ref is string => typeof ref === "string" && !!ref.trim())
        : [],
    };
  }
  return { primary: null, fallbacks: [] };
}

/** Resolve the configured default model + fallbacks from a config object. */
export function resolveDefaultModelSelection(config: Record<string, unknown> | null | undefined): {
  primary: string | null;
  fallbacks: string[];
} {
  return readDefaultModel(config ?? {});
}

/** Set the default model, preserving any configured fallback chain. */
export async function setDefaultModel(state: ModelsMutationState, ref: string): Promise<void> {
  const primary = ref.trim();
  if (!primary) {
    throw new Error("model ref is required");
  }
  await patchConfig(state, (config) => {
    const current = readDefaultModel(config);
    const fallbacks = current.fallbacks.filter((entry) => entry !== primary);
    return {
      patch: {
        agents: {
          defaults: {
            model: fallbacks.length > 0 ? { primary, fallbacks } : primary,
          },
        },
      },
      replacePaths: ["agents.defaults.model"],
    };
  });
}

/** Replace the fallback chain (order matters); keeps the current primary. */
export async function setModelFallbacks(
  state: ModelsMutationState,
  fallbacks: string[],
): Promise<void> {
  const cleaned = fallbacks.map((ref) => ref.trim()).filter((ref) => ref.length > 0);
  await patchConfig(state, (config) => {
    const current = readDefaultModel(config);
    if (!current.primary) {
      throw new Error("set a default model before adding backups");
    }
    const deduped = cleaned.filter((ref) => ref !== current.primary);
    return {
      patch: {
        agents: {
          defaults: {
            model:
              deduped.length > 0
                ? { primary: current.primary, fallbacks: deduped }
                : current.primary,
          },
        },
      },
      replacePaths: ["agents.defaults.model"],
    };
  });
}
