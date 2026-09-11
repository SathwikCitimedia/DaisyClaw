// `models.probeProvider`: look at an OpenAI-compatible server the user typed
// into the setup wizard / Model Studio and work out which product it is.
//
// Every server speaks the same /v1 dialect, so the wizard could already talk
// to them; recognising the product only decides which provider id and label
// the server is saved under (LiteLLM → `litellm`, Ollama → `ollama`, …) and
// lets the UI list the models the server advertises. Detection is a set of
// short, harmless GETs against well-known per-product endpoints, run in
// parallel with a tight timeout so the wizard never hangs on a dead VPN.
import { ErrorCodes, errorShape } from "../../../packages/gateway-protocol/src/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export type ProviderProbeKind =
  | "litellm"
  | "ollama"
  | "lmstudio"
  | "vllm"
  | "openai-compatible"
  | "unknown";

export type ProviderProbeResult = {
  /** True when any endpoint answered at all (even with an auth error). */
  reachable: boolean;
  kind: ProviderProbeKind;
  /** Provider id the server should be saved under (`custom` when unrecognised). */
  providerId: string;
  /** Human label for that provider id. */
  label: string;
  /** Base URL to store: the user's URL, normalised to the /v1 root when needed. */
  baseUrl: string;
  /** Model ids advertised by the server, when it answered a models listing. */
  models: string[];
  version?: string;
  /** True when the server answered a models listing with an auth error (401/403). */
  authRejected: boolean;
  error?: string;
};

type ProbeResponse = {
  ok: boolean;
  status: number;
  headers: Record<string, string>;
  json: unknown;
};

type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; signal: AbortSignal },
) => Promise<{
  ok: boolean;
  status: number;
  headers: { forEach: (cb: (value: string, key: string) => void) => void };
  text: () => Promise<string>;
}>;

export const PROVIDER_PROBE_LABELS: Record<ProviderProbeKind, string> = {
  litellm: "LiteLLM",
  ollama: "Ollama",
  lmstudio: "LM Studio",
  vllm: "vLLM",
  "openai-compatible": "Custom server",
  unknown: "Custom server",
};

const PROVIDER_PROBE_IDS: Record<ProviderProbeKind, string> = {
  litellm: "litellm",
  ollama: "ollama",
  lmstudio: "lmstudio",
  vllm: "vllm",
  "openai-compatible": "custom",
  unknown: "custom",
};

const DEFAULT_TIMEOUT_MS = 3000;

function normalizeBaseUrl(raw: string): URL {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Server URL is required");
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error("Server URL is not a valid address");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Server URL must start with http:// or https://");
  }
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

async function probeGet(
  fetchImpl: FetchLike,
  url: string,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<ProbeResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { method: "GET", headers, signal: controller.signal });
    const headerMap: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headerMap[key.toLowerCase()] = value;
    });
    let json: unknown = null;
    try {
      const text = await res.text();
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, headers: headerMap, json };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readModelIds(json: unknown): string[] {
  if (!json || typeof json !== "object") {
    return [];
  }
  const data = (json as { data?: unknown }).data;
  if (Array.isArray(data)) {
    return data
      .map((entry) => (entry as { id?: unknown } | null)?.id)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  }
  return [];
}

function readOllamaModelNames(json: unknown): string[] {
  const models = (json as { models?: unknown } | null)?.models;
  if (!Array.isArray(models)) {
    return [];
  }
  return models
    .map(
      (entry) =>
        (entry as { name?: unknown; model?: unknown } | null)?.name ??
        (entry as { model?: unknown } | null)?.model,
    )
    .filter((name): name is string => typeof name === "string" && name.trim().length > 0);
}

/**
 * Probes a server. Never throws for network failures — an unreachable server
 * comes back as `reachable: false` so callers can still save it and let the
 * user connect later (VPN off, laptop asleep, …). Throws only for a malformed URL.
 */
export async function probeOpenAiCompatibleServer(input: {
  baseUrl: string;
  apiKey?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}): Promise<ProviderProbeResult> {
  const fetchImpl = input.fetchImpl ?? (globalThis.fetch as unknown as FetchLike);
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = normalizeBaseUrl(input.baseUrl);
  const base = url.toString().replace(/\/+$/, "");
  const hasV1 = /\/v1$/i.test(url.pathname);
  const root = hasV1 ? base.replace(/\/v1$/i, "") : base;
  const v1 = hasV1 ? base : `${base}/v1`;

  const apiKey = input.apiKey?.trim();
  const headers: Record<string, string> = { accept: "application/json" };
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const [modelsAtBase, modelsAtV1, readiness, ollamaTags, lmstudioModels, version] =
    await Promise.all([
      probeGet(fetchImpl, `${base}/models`, headers, timeoutMs),
      hasV1 ? Promise.resolve(null) : probeGet(fetchImpl, `${v1}/models`, headers, timeoutMs),
      probeGet(fetchImpl, `${root}/health/readiness`, headers, timeoutMs),
      probeGet(fetchImpl, `${root}/api/tags`, headers, timeoutMs),
      probeGet(fetchImpl, `${root}/api/v0/models`, headers, timeoutMs),
      probeGet(fetchImpl, `${root}/version`, headers, timeoutMs),
    ]);

  const responses = [modelsAtBase, modelsAtV1, readiness, ollamaTags, lmstudioModels, version];
  const reachable = responses.some((res) => res !== null);

  const litellmHeader = responses.find((res) => res && "x-litellm-version" in res.headers);
  const readinessJson = readiness?.ok ? (readiness.json as Record<string, unknown> | null) : null;
  const litellmVersion =
    litellmHeader?.headers["x-litellm-version"] ??
    (typeof readinessJson?.litellm_version === "string"
      ? readinessJson.litellm_version
      : undefined);
  const isLitellm =
    Boolean(litellmVersion) || Boolean(readinessJson && "litellm_version" in readinessJson);

  const ollamaNames = ollamaTags?.ok ? readOllamaModelNames(ollamaTags.json) : [];
  const isOllama = Boolean(
    ollamaTags?.ok && Array.isArray((ollamaTags.json as { models?: unknown } | null)?.models),
  );

  const lmstudioIds = lmstudioModels?.ok ? readModelIds(lmstudioModels.json) : [];
  const isLmstudio = Boolean(
    lmstudioModels?.ok && Array.isArray((lmstudioModels.json as { data?: unknown } | null)?.data),
  );

  const versionJson = version?.ok ? (version.json as Record<string, unknown> | null) : null;
  const isVllm = Boolean(versionJson && typeof versionJson.version === "string");

  // Prefer whichever models listing worked; fall back to the URL the user typed.
  const openAiListing = modelsAtBase?.ok ? modelsAtBase : modelsAtV1?.ok ? modelsAtV1 : null;
  const openAiModels = openAiListing ? readModelIds(openAiListing.json) : [];
  const authRejected = [modelsAtBase, modelsAtV1].some(
    (res) => res !== null && (res.status === 401 || res.status === 403),
  );

  let kind: ProviderProbeKind;
  if (isLitellm) {
    kind = "litellm";
  } else if (isOllama) {
    kind = "ollama";
  } else if (isLmstudio) {
    kind = "lmstudio";
  } else if (isVllm) {
    kind = "vllm";
  } else if (openAiListing) {
    kind = "openai-compatible";
  } else {
    kind = "unknown";
  }

  // Store the /v1 root when that is where the OpenAI listing lives; Ollama and
  // LM Studio always serve the OpenAI dialect under /v1.
  let storedBaseUrl = base;
  if (
    !hasV1 &&
    (modelsAtV1?.ok ||
      (!modelsAtBase?.ok &&
        (kind === "ollama" || kind === "lmstudio" || kind === "litellm" || kind === "vllm")))
  ) {
    storedBaseUrl = v1;
  }

  const models =
    openAiModels.length > 0 ? openAiModels : ollamaNames.length > 0 ? ollamaNames : lmstudioIds;

  return {
    reachable,
    kind,
    providerId: PROVIDER_PROBE_IDS[kind],
    label: PROVIDER_PROBE_LABELS[kind],
    baseUrl: storedBaseUrl,
    models: Array.from(new Set(models)),
    ...(litellmVersion
      ? { version: litellmVersion }
      : versionJson && typeof versionJson.version === "string"
        ? { version: versionJson.version }
        : {}),
    authRejected,
    ...(reachable
      ? {}
      : {
          error: "No answer from that address. Check the URL, and that the server (or VPN) is on.",
        }),
  };
}

export const modelsProbeHandlers: GatewayRequestHandlers = {
  "models.probeProvider": async ({ params, respond }) => {
    const baseUrl = typeof params?.baseUrl === "string" ? params.baseUrl : "";
    const apiKey = typeof params?.apiKey === "string" ? params.apiKey : undefined;
    if (!baseUrl.trim()) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "models.probeProvider requires baseUrl"),
      );
      return;
    }
    try {
      respond(true, await probeOpenAiCompatibleServer({ baseUrl, apiKey }), undefined);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, err instanceof Error ? err.message : String(err)),
      );
    }
  },
};
