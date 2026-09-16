// Control UI controller: connecting a user-typed OpenAI-compatible server
// (LiteLLM, Ollama, LM Studio, vLLM, or anything speaking the same dialect).
//
// The setup wizard and Settings → Model Studio both do this, and they used to
// do it with two copies of the sequence. They drifted: the wizard always made
// the typed model the default, Settings only did so when its test passed, and
// Settings verified the provider name typed in the form rather than the id the
// server was actually saved under. Both now call `connectCustomProvider`.
import {
  CUSTOM_PROVIDER_LABELS,
  invalidateModelCatalog,
  probeCustomProvider,
  saveCustomProvider,
  setDefaultModel,
  type CustomProviderProbe,
  type ModelsMutationState,
} from "./models.ts";

/**
 * The address to store for a typed server.
 *
 * This is deliberately decided without needing the server to answer. It used to
 * come straight from a three-second probe: when the probe reached the server the
 * address was stored with `/v1`, and when it missed (VPN still connecting, the
 * engine just restarted after a reset, laptop asleep) the bare address was
 * stored instead. Chat then posted to a path the server does not serve and came
 * back "404 status code (no body)" — the same typing working or failing
 * depending on the network at that moment.
 *
 * Rules, in order:
 * - An address typed with its own path is kept exactly. The user knows where
 *   their server lives, including unusual mounts like `/openai/v1`.
 * - A bare address uses `/v1`, which is where every server this product
 *   supports serves the OpenAI dialect.
 * - The one exception is positive evidence to the contrary: the probe listed
 *   models at the bare root, so that root really is the API.
 */
export function resolveCustomProviderBaseUrl(params: {
  typed: string;
  probe?: Pick<CustomProviderProbe, "baseUrl" | "models"> | null;
}): string {
  const typed = params.typed.trim();
  if (!typed) {
    return "";
  }
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(typed) ? typed : `http://${typed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    // Not parseable here; hand it on unchanged and let the gateway say why.
    return typed;
  }
  url.hash = "";
  url.search = "";
  const path = url.pathname.replace(/\/+$/, "");
  const base = `${url.origin}${path}`;
  if (path) {
    return base;
  }
  const probedBase = params.probe?.baseUrl?.trim().replace(/\/+$/, "");
  const probeListedModelsAtRoot =
    (params.probe?.models?.length ?? 0) > 0 && Boolean(probedBase) && !/\/v1$/i.test(probedBase!);
  if (probeListedModelsAtRoot) {
    return probedBase!;
  }
  return `${base}/v1`;
}

export type ConnectCustomProviderInput = {
  /** Provider id the user typed, if any. Blank means "use what the server is". */
  typedName?: string;
  baseUrl: string;
  apiKey?: string;
  modelId: string;
};

export type ConnectCustomProviderResult = {
  /** The id the provider was saved under; what any later test must use. */
  providerId: string;
  /** Human label for messages ("LiteLLM", "Custom server"). */
  label: string;
  /** The address actually written to the config. */
  baseUrl: string;
  /** The model reference now set as the default. */
  modelRef: string;
  probe: CustomProviderProbe;
};

/**
 * Saves a user-typed server and makes the typed model the default.
 *
 * The probe only decides the display name and the extra model list. Whether
 * chat works no longer depends on it answering in time.
 */
export async function connectCustomProvider(
  state: ModelsMutationState,
  input: ConnectCustomProviderInput,
): Promise<ConnectCustomProviderResult> {
  const typedBaseUrl = input.baseUrl.trim();
  const modelId = input.modelId.trim();
  if (!typedBaseUrl || !modelId) {
    throw new Error("Enter the server address and a model name.");
  }
  const apiKey = input.apiKey?.trim() || undefined;
  const probe = await probeCustomProvider(state.client, {
    baseUrl: typedBaseUrl,
    ...(apiKey ? { apiKey } : {}),
  });
  const typedName = input.typedName?.trim().toLowerCase();
  const userNamed = Boolean(typedName && typedName !== "custom");
  const providerId = userNamed ? typedName! : probe.providerId || "custom";
  const label = userNamed
    ? (CUSTOM_PROVIDER_LABELS[providerId] ?? probe.label ?? providerId)
    : probe.label || CUSTOM_PROVIDER_LABELS[providerId] || "Custom server";
  const baseUrl = resolveCustomProviderBaseUrl({ typed: typedBaseUrl, probe });

  await saveCustomProvider(state, {
    providerId,
    baseUrl,
    ...(apiKey ? { apiKey } : {}),
    modelId,
    extraModelIds: probe.models,
    ...(providerId === "custom" ? {} : { modelNameSuffix: label }),
  });
  const modelRef = `${providerId}/${modelId}`;
  // Always. The wizard did this and worked; Settings made it conditional on a
  // test passing, so a user whose test failed was left with their model saved
  // but not selected.
  await setDefaultModel(state, modelRef);
  if (state.client) {
    invalidateModelCatalog(state.client);
  }
  return { providerId, label, baseUrl, modelRef, probe };
}

/** The one-line note to show after a save, or null when all was well. */
export function describeCustomProviderSave(result: ConnectCustomProviderResult): {
  tone: "success" | "info";
  message: string;
} {
  const { probe, label, baseUrl, modelRef } = result;
  const modelId = modelRef.slice(result.providerId.length + 1);
  if (!probe.reachable) {
    return {
      tone: "info",
      message: `Saved ${baseUrl}. The server did not answer just now — Daisy will connect once it is reachable (VPN on?).`,
    };
  }
  if (probe.authRejected) {
    return {
      tone: "info",
      message: `${label} rejected the API key. Check it in Settings if chats fail.`,
    };
  }
  if (probe.models.length > 0 && !probe.models.includes(modelId)) {
    return {
      tone: "info",
      message: `${label} does not list "${modelId}". Saved anyway — double-check the model name.`,
    };
  }
  return { tone: "success", message: `Connected to ${label}.` };
}
