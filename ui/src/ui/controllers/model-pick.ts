// Chooses which model to put in front of the user for a provider they just
// connected. Kept free of rendering imports on purpose: the first-run wizard,
// the model settings and the consumer smoke suite all call this one function,
// so the model the product picks and the model under test can never drift.
import type { ModelCatalogEntry } from "../types.ts";

export type PickedProviderModel = {
  /** Fully qualified reference, e.g. `openai/gpt-5.4`. */
  ref: string;
  /** Bare model id as the provider knows it, e.g. `gpt-5.4`. */
  modelId: string;
  /** Display name, for telling the user which model was chosen. */
  name: string;
};

function belongsToProvider(entry: ModelCatalogEntry, providerId: string): boolean {
  return (entry.provider ?? "").toLowerCase() === providerId.toLowerCase();
}

function toPicked(entry: ModelCatalogEntry): PickedProviderModel {
  // Catalog ids are exactly what the provider calls the model, and a slash is
  // part of that name for many of them: Groq's `groq/compound` and
  // `meta-llama/llama-4-scout-17b-16e-instruct`, OpenRouter's
  // `moonshotai/kimi-k2.6`, Groq's `openai/gpt-oss-120b`. An earlier version
  // read any slash as a provider prefix and cut it off, so those models were
  // tested and saved under names the provider has never heard of.
  const modelId = entry.id;
  return { ref: `${entry.provider}/${modelId}`, modelId, name: entry.name || modelId };
}

/**
 * The provider's models, best first, as candidates to try. Callers walk this
 * list so a model the account cannot use falls through to the next one instead
 * of ending the setup.
 */
export function listProviderModelCandidates(
  catalog: readonly ModelCatalogEntry[],
  providerId: string,
): PickedProviderModel[] {
  return catalog.filter((entry) => belongsToProvider(entry, providerId)).map(toPicked);
}

/** The single model the product offers first for a provider. */
export function pickProviderTestModel(
  catalog: readonly ModelCatalogEntry[],
  providerId: string,
): PickedProviderModel | null {
  return listProviderModelCandidates(catalog, providerId)[0] ?? null;
}
