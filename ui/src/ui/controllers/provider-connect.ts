// Control UI controller: connecting a preset provider (OpenAI, Anthropic,
// Google, Groq, OpenRouter) with an API key.
//
// One path for the setup wizard and Settings → Model Studio. Both used to save
// the key and then only choose a default model if a connection test passed, so
// a provider whose list arrived empty, or whose first test failed, left the
// user with a key saved and no model selected. Chat then fell back to the
// engine's built-in default — an OpenAI model — and a Google-only user saw a
// complaint about a missing OpenAI key.
import type { GatewayBrowserClient } from "../gateway.ts";
import { listProviderModelCandidates, type PickedProviderModel } from "./model-pick.ts";
import {
  invalidateModelCatalog,
  loadModels,
  saveProviderApiKey,
  setDefaultModel,
  verifyProviderModelCandidates,
  type ModelsMutationState,
  type VerifiedProviderModel,
} from "./models.ts";

export type ConnectApiKeyProviderInput = {
  providerId: string;
  apiKey: string;
  /**
   * "always": the typed model becomes the default no matter what (the wizard,
   * where this is the user's first and only provider).
   * "if-missing": only when there is no default yet, or the default names a
   * provider that has no key (the built-in placeholder). Settings uses this so
   * adding a second provider does not silently switch chat over to it.
   */
  setDefault: "always" | "if-missing";
  /** Test seam: how long to wait for the list to catch up after the save. */
  listRetryDelayMs?: number;
};

export type ConnectApiKeyProviderResult = {
  providerId: string;
  candidates: PickedProviderModel[];
  /** The default model set before any test ran, or null when none could be. */
  defaultBeforeTest: string | null;
  verified: VerifiedProviderModel;
  /**
   * True when the provider's model list stayed empty after every retry. The key
   * is saved, but nothing could be selected, so callers must say so instead of
   * reporting a finished setup.
   */
  listedNothing: boolean;
};

/**
 * Whether the default model is free to be taken over: there is none, it already
 * belongs to this provider, or it names a provider with no key saved (the
 * engine's built-in placeholder). Shared so Settings never steals a default
 * that is working for the user.
 */
export async function readDefaultNeedsSetting(
  client: GatewayBrowserClient | null,
  providerId: string,
): Promise<boolean> {
  if (!client) {
    return true;
  }
  try {
    const snapshot = (await client.request("config.get", {})) as {
      config?: {
        agents?: { defaults?: { model?: unknown } };
        models?: { providers?: Record<string, unknown> };
      };
    } | null;
    const raw = snapshot?.config?.agents?.defaults?.model;
    const primary =
      typeof raw === "string"
        ? raw
        : typeof (raw as { primary?: unknown } | undefined)?.primary === "string"
          ? (raw as { primary: string }).primary
          : "";
    if (!primary.trim()) {
      return true;
    }
    const currentProvider = primary.split("/")[0]?.trim().toLowerCase() ?? "";
    if (currentProvider === providerId.toLowerCase()) {
      return true;
    }
    // A default pointing at a provider with no key is the engine's built-in
    // placeholder, not a choice the user made; replace it.
    const providers = snapshot?.config?.models?.providers ?? {};
    return !Object.keys(providers).some((id) => id.toLowerCase() === currentProvider);
  } catch {
    return true;
  }
}

/**
 * Saves the key, makes one of the provider's models the default straight away,
 * then proves the key with a real test message, moving on to the next model
 * when an account cannot use the first. The model that answered becomes the
 * default; a failed test still leaves the provider's own model selected rather
 * than the engine's placeholder.
 */
export async function connectApiKeyProvider(
  state: ModelsMutationState,
  input: ConnectApiKeyProviderInput,
): Promise<ConnectApiKeyProviderResult> {
  const providerId = input.providerId.trim().toLowerCase();
  await saveProviderApiKey(state, providerId, input.apiKey);

  let candidates: PickedProviderModel[] = [];
  if (state.client) {
    invalidateModelCatalog(state.client);
    try {
      candidates = listProviderModelCandidates(await loadModels(state.client), providerId);
      // The gateway rebuilds its catalog after the config change, and it
      // answers with an empty list rather than waiting. On a cold machine one
      // retry was not always enough, and an empty list here used to mean no
      // default model was chosen at all.
      const retryDelayMs = input.listRetryDelayMs ?? 1200;
      for (let attempt = 0; attempt < 2 && candidates.length === 0; attempt += 1) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, retryDelayMs * (attempt + 1));
        });
        invalidateModelCatalog(state.client);
        candidates = listProviderModelCandidates(await loadModels(state.client), providerId);
      }
    } catch {
      // Handled below, by reporting it rather than pretending the provider is
      // ready.
    }
  }

  let defaultBeforeTest: string | null = null;
  const first = candidates[0];
  if (first) {
    const shouldSet =
      input.setDefault === "always" || (await readDefaultNeedsSetting(state.client, providerId));
    if (shouldSet) {
      await setDefaultModel(state, first.ref);
      defaultBeforeTest = first.ref;
    }
  }

  const verified = await verifyProviderModelCandidates({
    client: state.client,
    providerId,
    candidates,
  });
  if (verified.verdict?.ok && verified.model && verified.model.ref !== defaultBeforeTest) {
    // A later candidate answered where the first could not: use the one that works.
    if (input.setDefault === "always" || defaultBeforeTest !== null) {
      await setDefaultModel(state, verified.model.ref);
    }
  }
  return {
    providerId,
    candidates,
    defaultBeforeTest,
    verified,
    listedNothing: candidates.length === 0,
  };
}
