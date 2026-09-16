import { noteConfigWriteRestart, type ConfigWriteResponse } from "../config-restart-notice.ts";
// Control UI controller manages models gateway state.
import type { GatewayBrowserClient } from "../gateway.ts";
import type { ModelCatalogEntry } from "../types.ts";
import type { PickedProviderModel } from "./model-pick.ts";

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

export type ModelsMutationState = {
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
  const response = await state.client.request<ConfigWriteResponse>("config.patch", {
    raw: JSON.stringify(result.patch),
    baseHash: snapshot?.hash,
    ...(result.replacePaths?.length ? { replacePaths: result.replacePaths } : {}),
  });
  noteConfigWriteRestart(response);
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

/**
 * Loads the catalog right after a provider/model save. The gateway rebuilds
 * its catalog on config hot-reload, which can land a moment after the write,
 * so when the expected model is missing we wait briefly and try again instead
 * of showing "not in the current catalog" for a model that was just saved.
 */
export async function loadModelsExpecting(
  client: GatewayBrowserClient,
  expectedRef: string | null | undefined,
  options: { retries?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<ModelCatalogEntry[]> {
  const retries = options.retries ?? 2;
  const delayMs = options.delayMs ?? 1200;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let catalog = await loadModels(client);
  const expected = expectedRef?.trim();
  if (!expected) {
    return catalog;
  }
  for (let attempt = 0; attempt < retries; attempt += 1) {
    if (catalog.some((entry) => modelCatalogRef(entry) === expected || entry.id === expected)) {
      return catalog;
    }
    await sleep(delayMs);
    invalidateModelCatalog(client);
    catalog = await loadModels(client);
  }
  return catalog;
}

/** What the gateway learned about a user-typed OpenAI-compatible server. */
export type CustomProviderProbe = {
  reachable: boolean;
  kind: "litellm" | "ollama" | "lmstudio" | "vllm" | "openai-compatible" | "unknown";
  providerId: string;
  label: string;
  baseUrl: string;
  models: string[];
  version?: string;
  authRejected: boolean;
  error?: string;
};

/** Friendly names for the provider ids a custom server can be saved under. */
export const CUSTOM_PROVIDER_LABELS: Record<string, string> = {
  litellm: "LiteLLM",
  ollama: "Ollama",
  lmstudio: "LM Studio",
  vllm: "vLLM",
  custom: "Custom server",
};

/**
 * Asks the gateway to look at a server and say which product it is (LiteLLM,
 * Ollama, …) plus the models it advertises. Never throws for an unreachable
 * server; returns a generic "custom" answer instead so saving can proceed.
 */
export async function probeCustomProvider(
  client: GatewayBrowserClient | null,
  input: { baseUrl: string; apiKey?: string },
): Promise<CustomProviderProbe> {
  const fallback: CustomProviderProbe = {
    reachable: false,
    kind: "unknown",
    providerId: "custom",
    label: CUSTOM_PROVIDER_LABELS.custom,
    baseUrl: input.baseUrl.trim(),
    models: [],
    authRejected: false,
  };
  if (!client) {
    return fallback;
  }
  try {
    const result = await client.request<CustomProviderProbe>("models.probeProvider", {
      baseUrl: input.baseUrl.trim(),
      ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
    });
    if (!result || typeof result !== "object" || typeof result.providerId !== "string") {
      return fallback;
    }
    return {
      ...fallback,
      ...result,
      models: Array.isArray(result.models)
        ? result.models.filter((id): id is string => typeof id === "string" && !!id.trim())
        : [],
    };
  } catch {
    // Older gateways without the probe method: keep the generic answer.
    return fallback;
  }
}

/** Verdict from a real test message sent through a provider. */
export type ProviderTestResult = {
  ok: boolean;
  reason:
    | "ok"
    | "no_key"
    | "invalid_key"
    | "no_credit"
    | "rate_limited"
    | "model_not_found"
    // Nothing is served at the saved address (an empty 404). Not the model's
    // fault and not the account's, so trying another model never helps.
    | "bad_endpoint"
    | "network"
    | "timeout"
    | "unknown_model"
    | "unknown";
  message: string;
  provider: string;
  model?: string;
  status?: number;
};

/**
 * Asks the gateway to send one tiny message through a provider so the user is
 * told what is actually wrong (key rejected, no credit, no internet, model not
 * available) instead of meeting "LLM request failed." in chat later.
 *
 * Returns null when the gateway is too old to know the method, so callers can
 * carry on rather than block a working setup.
 */
export async function testProviderConnection(
  client: GatewayBrowserClient | null,
  input: { providerId: string; modelId?: string; apiKey?: string },
): Promise<ProviderTestResult | null> {
  if (!client) {
    return null;
  }
  try {
    const result = await client.request<ProviderTestResult>(
      "models.testProvider",
      {
        providerId: input.providerId,
        ...(input.modelId?.trim() ? { modelId: input.modelId.trim() } : {}),
        ...(input.apiKey?.trim() ? { apiKey: input.apiKey.trim() } : {}),
      },
      { timeoutMs: 40_000 },
    );
    if (!result || typeof result !== "object" || typeof result.ok !== "boolean") {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * How many models to try before giving up on a provider. More than a couple,
 * because the model list can offer entries this engine cannot resolve, and a
 * run of those must not end setup for a key that works.
 */
const MAX_MODEL_VERIFY_ATTEMPTS = 5;

/** Verdicts that say "this model", not "this account". Worth trying another. */
const MODEL_SPECIFIC_TEST_REASONS = new Set(["model_not_found", "unknown_model"]);

export type VerifiedProviderModel = {
  /** The model that answered, when one did. */
  model: PickedProviderModel | null;
  /** The verdict to show: the success, or the failure worth reporting. */
  verdict: ProviderTestResult | null;
  /** Models tried before this verdict, for telling the user what happened. */
  attempted: PickedProviderModel[];
};

/**
 * Finds a model of this provider that actually answers.
 *
 * Accounts differ in which models they may call, so the first model in our
 * catalog is a guess, not a fact. Treating that guess as the account's only
 * option is what told users their key did not work when a different model would
 * have worked fine. A verdict about the key, the credit or the network applies
 * to every model, so it stops the walk immediately.
 */
export async function verifyProviderModelCandidates(params: {
  client: GatewayBrowserClient | null;
  providerId: string;
  candidates: readonly PickedProviderModel[];
  apiKey?: string;
  maxAttempts?: number;
}): Promise<VerifiedProviderModel> {
  const attempted: PickedProviderModel[] = [];
  let lastVerdict: ProviderTestResult | null = null;
  const limit = Math.max(1, params.maxAttempts ?? MAX_MODEL_VERIFY_ATTEMPTS);
  // With no catalog to walk, let the gateway resolve the provider's own default.
  const candidates = params.candidates.length > 0 ? params.candidates.slice(0, limit) : [null];
  for (const candidate of candidates) {
    if (candidate) {
      attempted.push(candidate);
    }
    const verdict = await testProviderConnection(params.client, {
      providerId: params.providerId,
      ...(candidate ? { modelId: candidate.modelId } : {}),
      ...(params.apiKey ? { apiKey: params.apiKey } : {}),
    });
    lastVerdict = verdict;
    if (!verdict) {
      return { model: null, verdict: null, attempted };
    }
    if (verdict.ok) {
      return { model: candidate, verdict, attempted };
    }
    if (!MODEL_SPECIFIC_TEST_REASONS.has(verdict.reason)) {
      return { model: null, verdict, attempted };
    }
  }
  return { model: null, verdict: lastVerdict, attempted };
}

/** Most models a probed server may add to the list next to the one the user typed. */
const MAX_PROBED_MODELS = 40;

/** Register a custom OpenAI-compatible provider (LiteLLM, vLLM, local server…). */
export async function saveCustomProvider(
  state: ModelsMutationState,
  input: {
    providerId: string;
    baseUrl: string;
    apiKey?: string;
    modelId: string;
    /** Extra model ids the server advertised; listed after the typed model. */
    extraModelIds?: string[];
    /** Display suffix for listed models, e.g. "LiteLLM" → "gpt-5 (LiteLLM)". */
    modelNameSuffix?: string;
  },
): Promise<void> {
  const providerId = input.providerId.trim().toLowerCase();
  const baseUrl = input.baseUrl.trim();
  const modelId = input.modelId.trim();
  if (!providerId || !baseUrl || !modelId) {
    throw new Error("server name, address, and model id are required");
  }
  const apiKey = input.apiKey?.trim();
  const suffix = input.modelNameSuffix?.trim();
  const displayName = (id: string) => (suffix ? `${id} (${suffix})` : id);
  const extraIds = (input.extraModelIds ?? [])
    .map((id) => id.trim())
    .filter((id) => id && id !== modelId)
    .slice(0, MAX_PROBED_MODELS);
  await patchConfig(state, (config) => {
    const providers =
      ((config.models as Record<string, unknown> | undefined)?.providers as
        | Record<string, unknown>
        | undefined) ?? {};
    const existing = (providers[providerId] ?? {}) as Record<string, unknown>;
    const existingModels = Array.isArray(existing.models)
      ? (existing.models as Array<{ id?: string }>)
      : [];
    const listed = new Set(
      existingModels.map((entry) => entry?.id).filter((id): id is string => typeof id === "string"),
    );
    const additions = [modelId, ...extraIds]
      .filter((id) => !listed.has(id))
      .map((id) => ({ id, name: displayName(id) }));
    const alreadyListed = additions.length === 0;
    return {
      patch: {
        models: {
          providers: {
            [providerId]: {
              baseUrl,
              // Custom servers speak the OpenAI chat dialect; say so explicitly
              // so the gateway never guesses from the id.
              ...(typeof existing.api === "string" ? {} : { api: "openai-completions" }),
              ...(apiKey ? { apiKey } : {}),
              ...(alreadyListed ? {} : { models: [...existingModels, ...additions] }),
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
